
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// OpenZeppelin v5 imports
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title Base2048
 * @notice Stores best scores for up to MAX_PLAYERS players with fee collection.
 * @dev Adds EIP-712 signed submission: player pays gas+fee, backend signs off-chain.
 */
contract Base2048 is Ownable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    // -------------------- Types --------------------
    struct PlayerScore {
        uint256 bestScore;
        uint256 bestMoves;
        uint256 bestTime; // seconds
        bool exists;
    }

    // -------------------- Storage --------------------
    mapping(address => PlayerScore) public playerScores;
    address[] public players;

    // Fixed player cap (non-upgradeable by design)
    uint256 public constant MAX_PLAYERS = 50;

    uint256 public feeAmount;
    address public feeRecipient;

    // Authorized backend (signer; separate from owner)
    address public backend;

    // Nonce per player to prevent signature replay
    mapping(address => uint256) public nonces;

   // EIP-712 typehash for score submission
// keccak256("Score(address player,uint256 score,uint256 moves,uint256 time,uint256 nonce,uint256 deadline)")
bytes32 private constant SCORE_TYPEHASH =
    0x6c05e84c65517123c3ed862e6425e4e8ce651bfc2f433f026650b0429aee5d78;

    // -------------------- Events --------------------
    event ScoreSubmitted(
        address indexed player,
        uint256 score,
        uint256 moves,
        uint256 time,
        uint256 feePaid
    );
    event FeeUpdated(uint256 newFeeAmount);
    event FeeRecipientUpdated(address newRecipient);
    event BackendUpdated(address newBackend);

    // -------------------- Errors --------------------
    error MaxPlayersReached();
    error InvalidScore();
    error InsufficientFee();
    error OnlyBackend();
    error InvalidAddress();
    error InvalidSigner();
    error SignatureExpired();
    error SenderMustBePlayer();

    // -------------------- Modifiers --------------------
    modifier onlyBackend() {
        if (msg.sender != backend) revert OnlyBackend();
        _;
    }

    // -------------------- Constructor --------------------
    /**
     * @param _feeAmount Fee (in wei) required per score submission
     * @param _feeRecipient Address to receive collected fees
     * @param _backend Authorized backend address that signs score payloads
     */
    constructor(
        uint256 _feeAmount,
        address _feeRecipient,
        address _backend
    )
        Ownable(msg.sender)
        EIP712("Base2048", "1")
    {
        if (_feeRecipient == address(0) || _backend == address(0))
            revert InvalidAddress();
        feeAmount = _feeAmount;
        feeRecipient = _feeRecipient;
        backend = _backend;
    }

    // -------------------- Core Logic --------------------
    /**
     * @notice Submit a new score using backend's EIP-712 signature.
     * @dev Player pays gas and fee; contract verifies backend signature.
     *      Tie-breakers when scores are equal: fewer moves, then lower time.
     * @param player The player's address (must equal msg.sender)
     * @param score  Score value (>0)
     * @param moves  Number of moves
     * @param time   Duration in seconds
     * @param deadline Unix timestamp after which the signature is invalid
     * @param v,r,s  Backend ECDSA signature over typed data
     */
    function submitScoreWithSig(
        address player,
        uint256 score,
        uint256 moves,
        uint256 time,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable nonReentrant {
        if (msg.sender != player) revert SenderMustBePlayer();
        if (score == 0) revert InvalidScore();
        if (msg.value < feeAmount) revert InsufficientFee();
        if (block.timestamp > deadline) revert SignatureExpired();

        // Build EIP-712 typed data hash
        bytes32 structHash = keccak256(
            abi.encode(
                SCORE_TYPEHASH,
                player,
                score,
                moves,
                time,
                nonces[player],
                deadline
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);

        // Recover signer and verify it matches backend
        address signer = ECDSA.recover(digest, v, r, s);
        if (signer != backend) revert InvalidSigner();

        // Consume nonce
        unchecked { nonces[player] = nonces[player] + 1; }

        // Upsert player record
        PlayerScore storage ps = playerScores[player];
        if (!ps.exists) {
            if (players.length >= MAX_PLAYERS) revert MaxPlayersReached();
            players.push(player);
            ps.exists = true;
        }

        if (score > ps.bestScore) {
            ps.bestScore = score;
            ps.bestMoves = moves;
            ps.bestTime = time;
        } else if (score == ps.bestScore) {
            if (moves < ps.bestMoves || (moves == ps.bestMoves && time < ps.bestTime)) {
                ps.bestMoves = moves;
                ps.bestTime = time;
            }
        }

        emit ScoreSubmitted(player, score, moves, time, msg.value);
    }

    /**
     * @notice Legacy: backend-submitted path (backend pays gas+fee).
     * @dev Still available for maintenance; preferred path is submitScoreWithSig.
     */
    function submitScore(
        address player,
        uint256 score,
        uint256 moves,
        uint256 time
    ) external payable onlyBackend nonReentrant {
        if (score == 0) revert InvalidScore();
        if (msg.value < feeAmount) revert InsufficientFee();

        PlayerScore storage ps = playerScores[player];
        if (!ps.exists) {
            if (players.length >= MAX_PLAYERS) revert MaxPlayersReached();
            players.push(player);
            ps.exists = true;
        }

        if (score > ps.bestScore) {
            ps.bestScore = score;
            ps.bestMoves = moves;
            ps.bestTime = time;
        } else if (score == ps.bestScore) {
            if (moves < ps.bestMoves || (moves == ps.bestMoves && time < ps.bestTime)) {
                ps.bestMoves = moves;
                ps.bestTime = time;
            }
        }

        emit ScoreSubmitted(player, score, moves, time, msg.value);
    }

    // -------------------- Views --------------------
    function getPlayerScore(
        address player
    ) external view returns (uint256 bestScore, uint256 bestMoves, uint256 bestTime, bool exists) {
        PlayerScore memory s = playerScores[player];
        return (s.bestScore, s.bestMoves, s.bestTime, s.exists);
    }

    function getAllPlayers()
        external
        view
        returns (address[] memory, uint256[] memory, uint256[] memory, uint256[] memory)
    {
        uint256 length = players.length;
        address[] memory addrs = new address[](length);
        uint256[] memory scores = new uint256[](length);
        uint256[] memory moves = new uint256[](length);
        uint256[] memory times = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            address p = players[i];
            PlayerScore memory s = playerScores[p];
            addrs[i] = p;
            scores[i] = s.bestScore;
            moves[i] = s.bestMoves;
            times[i] = s.bestTime;
        }
        return (addrs, scores, moves, times);
    }

    function getLeaderboard(uint256 limit)
        external
        view
        returns (address[] memory, uint256[] memory, uint256[] memory, uint256[] memory)
    {
        uint256 length = players.length;
        if (limit > length) limit = length;

        address[] memory sortedPlayers = new address[](length);
        uint256[] memory sortedScores = new uint256[](length);
        uint256[] memory sortedMoves  = new uint256[](length);
        uint256[] memory sortedTimes  = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            address p = players[i];
            PlayerScore memory s = playerScores[p];
            sortedPlayers[i] = p;
            sortedScores[i]  = s.bestScore;
            sortedMoves[i]   = s.bestMoves;
            sortedTimes[i]   = s.bestTime;
        }

        for (uint256 i = 0; i < length; i++) {
            for (uint256 j = 0; j + 1 < length - i; j++) {
                bool worse = (sortedScores[j] < sortedScores[j + 1]) ||
                    (sortedScores[j] == sortedScores[j + 1] && sortedMoves[j] > sortedMoves[j + 1]) ||
                    (sortedScores[j] == sortedScores[j + 1] && sortedMoves[j] == sortedMoves[j + 1] && sortedTimes[j] > sortedTimes[j + 1]);

                if (worse) {
                    (sortedScores[j], sortedScores[j + 1]) = (sortedScores[j + 1], sortedScores[j]);
                    (sortedMoves[j],  sortedMoves[j + 1])  = (sortedMoves[j + 1],  sortedMoves[j]);
                    (sortedTimes[j],  sortedTimes[j + 1])  = (sortedTimes[j + 1],  sortedTimes[j]);
                    (sortedPlayers[j], sortedPlayers[j + 1]) = (sortedPlayers[j + 1], sortedPlayers[j]);
                }
            }
        }

        address[] memory rPlayers = new address[](limit);
        uint256[] memory rScores  = new uint256[](limit);
        uint256[] memory rMoves   = new uint256[](limit);
        uint256[] memory rTimes   = new uint256[](limit);
        for (uint256 i = 0; i < limit; i++) {
            rPlayers[i] = sortedPlayers[i];
            rScores[i]  = sortedScores[i];
            rMoves[i]   = sortedMoves[i];
            rTimes[i]   = sortedTimes[i];
        }
        return (rPlayers, rScores, rMoves, rTimes);
    }

    /// @notice Returns summary stats of the contract.
    function getStats()
        external
        view
        returns (
            uint256 totalPlayers,
            uint256 currentFee,
            address currentFeeRecipient,
            address currentBackend,
            uint256 maxPlayersCap
        )
    {
        return (players.length, feeAmount, feeRecipient, backend, MAX_PLAYERS);
    }

    // -------------------- Admin --------------------
    function updateFeeAmount(uint256 _feeAmount) external onlyOwner {
        feeAmount = _feeAmount;
        emit FeeUpdated(_feeAmount);
    }

    function updateFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert InvalidAddress();
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(_feeRecipient);
    }

    function updateBackend(address _backend) external onlyOwner {
        if (_backend == address(0)) revert InvalidAddress();
        backend = _backend;
        emit BackendUpdated(_backend);
    }

    /**
     * @notice Withdraw all collected fees to feeRecipient.
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        (bool ok, ) = feeRecipient.call{value: balance}("");
        require(ok, "Transfer failed");
    }

    // -------------------- Receive Ether --------------------
    receive() external payable {}
}
