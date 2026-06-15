// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PaiPalaceStaking
 * @notice Escrow + staking vault for PaiPalace AI poker agents.
 *
 *         Users deposit an ERC-20 stablecoin (e.g. USDC), the protocol credits
 *         their off-chain balance, and users stake into a given agent. Game
 *         settlement is reported by an authorized `settler` (the game server),
 *         which distributes net winnings/losses across each agent's stakers
 *         pro-rata.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ ⚠️  SECURITY & LEGAL WARNING                                              │
 * │ This contract is a PROTOTYPE for a TESTNET. Before any mainnet use with   │
 * │ real funds it MUST be: (1) professionally audited, (2) operated under a   │
 * │ gambling license valid in each target jurisdiction, (3) paired with      │
 * │ KYC/AML, and (4) reviewed for the trusted-settler centralization risk    │
 * │ below. Do NOT deploy to mainnet as-is.                                    │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 *  Centralization note: `settler` can move staked funds via settlement. In a
 *  production system this must be replaced/constrained by an on-chain,
 *  verifiable game-result mechanism (e.g. commit-reveal RNG, optimistic
 *  fraud proofs, or a decentralized oracle), not a single trusted key.
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract PaiPalaceStaking {
    address public owner;
    address public settler; // authorized game server
    IERC20 public immutable token;

    // user => withdrawable balance
    mapping(address => uint256) public balanceOf;
    // agentId (bytes32) => total staked
    mapping(bytes32 => uint256) public agentStake;
    // agentId => user => staked amount
    mapping(bytes32 => mapping(address => uint256)) public stakeOf;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Staked(address indexed user, bytes32 indexed agentId, uint256 amount);
    event Unstaked(address indexed user, bytes32 indexed agentId, uint256 amount);
    event Settled(bytes32 indexed agentId, int256 netDelta);
    event SettlerUpdated(address indexed settler);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }
    modifier onlySettler() {
        require(msg.sender == settler, "not settler");
        _;
    }

    constructor(address _token, address _settler) {
        owner = msg.sender;
        token = IERC20(_token);
        settler = _settler;
    }

    function setSettler(address _settler) external onlyOwner {
        settler = _settler;
        emit SettlerUpdated(_settler);
    }

    /// @notice Deposit `amount` of the stablecoin into your spendable balance.
    function deposit(uint256 amount) external {
        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");
        balanceOf[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice Withdraw `amount` of your spendable balance back to your wallet.
    function withdraw(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        require(token.transfer(msg.sender, amount), "transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Stake spendable balance behind an agent.
    function stake(bytes32 agentId, uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        stakeOf[agentId][msg.sender] += amount;
        agentStake[agentId] += amount;
        emit Staked(msg.sender, agentId, amount);
    }

    /// @notice Unstake from an agent back to your spendable balance.
    function unstake(bytes32 agentId, uint256 amount) external {
        require(stakeOf[agentId][msg.sender] >= amount, "insufficient stake");
        stakeOf[agentId][msg.sender] -= amount;
        agentStake[agentId] -= amount;
        balanceOf[msg.sender] += amount;
        emit Unstaked(msg.sender, agentId, amount);
    }

    /**
     * @notice Settle a game outcome for an agent. The settler reports the net
     *         delta (winnings positive, losses negative) and the list of
     *         stakers; the delta is split pro-rata by stake.
     * @dev    Production systems must replace this trusted call with a
     *         verifiable result source. See the warning at the top.
     */
    function settle(bytes32 agentId, address[] calldata stakers, int256 netDelta)
        external
        onlySettler
    {
        uint256 total = agentStake[agentId];
        if (total == 0) return;
        for (uint256 i = 0; i < stakers.length; i++) {
            address s = stakers[i];
            uint256 stk = stakeOf[agentId][s];
            if (stk == 0) continue;
            int256 share = (netDelta * int256(stk)) / int256(total);
            if (share >= 0) {
                balanceOf[s] += uint256(share);
            } else {
                uint256 loss = uint256(-share);
                balanceOf[s] = balanceOf[s] > loss ? balanceOf[s] - loss : 0;
            }
        }
        emit Settled(agentId, netDelta);
    }
}
