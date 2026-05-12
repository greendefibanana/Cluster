// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IStrategyAdapter} from "./interfaces/IStrategyAdapter.sol";

contract UserStrategyAccount is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable factory;
    address public owner;
    address public approvedExecutor;
    bytes32 public strategyId;
    address public asset;
    uint256 public maxAllocation;
    uint256 public maxSlippageBps;
    bool public active;

    mapping(address => bool) public allowedAdapters;

    event Deposited(address indexed asset, uint256 amount);
    event Withdrawn(address indexed asset, uint256 amount, address indexed receiver);
    event ExecutorUpdated(address indexed executor);
    event AdapterSet(address indexed adapter, bool allowed);
    event RiskLimitsUpdated(uint256 maxAllocation, uint256 maxSlippageBps);
    event Paused();
    event Resumed();
    event Closed(address indexed receiver, uint256 returnedAmount);
    event StrategyExecuted(address indexed executor, address indexed adapter, address indexed asset, uint256 amount, bytes32 action);

    constructor() {
        factory = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function initialize(
        address accountOwner,
        address executor,
        bytes32 accountStrategyId,
        address depositedAsset,
        uint256 allocationLimit,
        uint256 slippageLimitBps,
        address[] calldata adapters
    ) external {
        require(msg.sender == factory, "not factory");
        require(owner == address(0), "initialized");
        require(accountOwner != address(0), "invalid owner");
        require(executor != address(0), "invalid executor");
        require(depositedAsset != address(0), "invalid asset");
        require(slippageLimitBps <= 10_000, "bad slippage");

        owner = accountOwner;
        approvedExecutor = executor;
        strategyId = accountStrategyId;
        asset = depositedAsset;
        maxAllocation = allocationLimit;
        maxSlippageBps = slippageLimitBps;
        active = true;

        for (uint256 i = 0; i < adapters.length; i++) {
            require(adapters[i] != address(0), "invalid adapter");
            allowedAdapters[adapters[i]] = true;
            emit AdapterSet(adapters[i], true);
        }
    }

    function deposit(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "amount zero");
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(asset, amount);
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "amount zero");
        IERC20(asset).safeTransfer(owner, amount);
        emit Withdrawn(asset, amount, owner);
    }

    function setApprovedExecutor(address executor) external onlyOwner {
        approvedExecutor = executor;
        emit ExecutorUpdated(executor);
    }

    function revokeExecutor() external onlyOwner {
        approvedExecutor = address(0);
        emit ExecutorUpdated(address(0));
    }

    function setAdapter(address adapter, bool allowed) external onlyOwner {
        require(adapter != address(0), "invalid adapter");
        allowedAdapters[adapter] = allowed;
        emit AdapterSet(adapter, allowed);
    }

    function setRiskLimits(uint256 allocationLimit, uint256 slippageLimitBps) external onlyOwner {
        require(slippageLimitBps <= 10_000, "bad slippage");
        maxAllocation = allocationLimit;
        maxSlippageBps = slippageLimitBps;
        emit RiskLimitsUpdated(allocationLimit, slippageLimitBps);
    }

    function pause() external onlyOwner {
        active = false;
        emit Paused();
    }

    function resume() external onlyOwner {
        active = true;
        emit Resumed();
    }

    function close() external onlyOwner nonReentrant {
        active = false;
        uint256 balance = IERC20(asset).balanceOf(address(this));
        if (balance > 0) {
            IERC20(asset).safeTransfer(owner, balance);
        }
        emit Closed(owner, balance);
    }

    function executeStrategy(address adapter, bytes calldata data) external nonReentrant returns (bytes memory result) {
        require(active, "account paused");
        require(msg.sender == approvedExecutor, "not executor");
        require(allowedAdapters[adapter], "adapter not allowed");

        (address executionAsset, uint256 amount, address receiver, uint256 slippageBps, bytes32 action) =
            IStrategyAdapter(adapter).previewExecution(data);

        require(executionAsset == asset, "wrong asset");
        require(amount <= maxAllocation, "allocation exceeded");
        require(amount <= IERC20(asset).balanceOf(address(this)), "insufficient balance");
        require(slippageBps <= maxSlippageBps, "slippage exceeded");
        require(receiver == address(this) || receiver == owner, "unauthorized receiver");

        IERC20(asset).safeApprove(adapter, 0);
        IERC20(asset).safeApprove(adapter, amount);
        (bool success, bytes memory response) = adapter.call(data);
        IERC20(asset).safeApprove(adapter, 0);
        if (!success) {
            assembly {
                revert(add(response, 0x20), mload(response))
            }
        }

        emit StrategyExecuted(msg.sender, adapter, asset, amount, action);
        return response;
    }
}
