/**
 * DAO Deployer - Custom Error Types
 * 
 * Comprehensive error handling for blockchain operations,
 * transaction failures, and DAO-specific errors.
 */

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

export class DAOError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;
  public readonly cause?: Error;

  constructor(message: string, code: string, context?: Record<string, unknown>, cause?: Error) {
    super(message);
    this.name = 'DAOError';
    this.code = code;
    this.context = context;
    this.cause = cause;
    
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DAOError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      cause: this.cause?.message,
    };
  }
}

// ============================================================================
// CHAIN ERRORS
// ============================================================================

export class ChainError extends DAOError {
  constructor(message: string, chainId?: number, cause?: Error) {
    super(
      message,
      'CHAIN_ERROR',
      chainId ? { chainId } : undefined,
      cause
    );
    this.name = 'ChainError';
  }
}

export class UnsupportedChainError extends ChainError {
  constructor(chainId: number) {
    super(`Chain ${chainId} is not supported`, chainId);
    this.name = 'UnsupportedChainError';
  }
}

export class ChainConnectionError extends ChainError {
  constructor(chainId: number, cause?: Error) {
    super(`Failed to connect to chain ${chainId}`, chainId, cause);
    this.name = 'ChainConnectionError';
  }
}

// ============================================================================
// TRANSACTION ERRORS
// ============================================================================

export class TransactionError extends DAOError {
  public readonly transactionHash?: string;
  public readonly receipt?: unknown;

  constructor(
    message: string,
    code: string,
    transactionHash?: string,
    receipt?: unknown,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, { ...context, transactionHash, receipt }, cause);
    this.name = 'TransactionError';
    this.transactionHash = transactionHash;
    this.receipt = receipt;
  }
}

export class TransactionRevertedError extends TransactionError {
  constructor(transactionHash: string, receipt?: unknown, cause?: Error) {
    super(
      `Transaction ${transactionHash} was reverted`,
      'TRANSACTION_REVERTED',
      transactionHash,
      receipt,
      undefined,
      cause
    );
    this.name = 'TransactionRevertedError';
  }
}

export class TransactionFailedError extends TransactionError {
  constructor(message: string, transactionHash?: string, cause?: Error) {
    super(
      message,
      'TRANSACTION_FAILED',
      transactionHash,
      undefined,
      undefined,
      cause
    );
    this.name = 'TransactionFailedError';
  }
}

export class InsufficientFundsError extends TransactionError {
  constructor(required: bigint, available: bigint, cause?: Error) {
    super(
      `Insufficient funds. Required: ${required}, Available: ${available}`,
      'INSUFFICIENT_FUNDS',
      undefined,
      undefined,
      { required: required.toString(), available: available.toString() },
      cause
    );
    this.name = 'InsufficientFundsError';
  }
}

export class GasEstimationError extends TransactionError {
  constructor(message: string, cause?: Error) {
    super(
      `Gas estimation failed: ${message}`,
      'GAS_ESTIMATION_FAILED',
      undefined,
      undefined,
      undefined,
      cause
    );
    this.name = 'GasEstimationError';
  }
}

export class NonceError extends TransactionError {
  constructor(expected: number, actual: number, cause?: Error) {
    super(
      `Nonce mismatch. Expected: ${expected}, Actual: ${actual}`,
      'NONCE_ERROR',
      undefined,
      undefined,
      { expected, actual },
      cause
    );
    this.name = 'NonceError';
  }
}

export class TransactionTimeoutError extends TransactionError {
  constructor(timeoutMs: number, transactionHash?: string, cause?: Error) {
    super(
      `Transaction timed out after ${timeoutMs}ms`,
      'TRANSACTION_TIMEOUT',
      transactionHash,
      undefined,
      { timeoutMs },
      cause
    );
    this.name = 'TransactionTimeoutError';
  }
}

export class UserRejectedError extends TransactionError {
  constructor(cause?: Error) {
    super(
      'Transaction was rejected by user',
      'USER_REJECTED',
      undefined,
      undefined,
      undefined,
      cause
    );
    this.name = 'UserRejectedError';
  }
}

// ============================================================================
// CONTRACT ERRORS
// ============================================================================

export class ContractError extends DAOError {
  public readonly contractAddress?: string;
  public readonly functionName?: string;
  public readonly args?: unknown[];

  constructor(
    message: string,
    code: string,
    contractAddress?: string,
    functionName?: string,
    args?: unknown[],
    cause?: Error
  ) {
    super(message, code, { contractAddress, functionName, args }, cause);
    this.name = 'ContractError';
    this.contractAddress = contractAddress;
    this.functionName = functionName;
    this.args = args;
  }
}

export class ContractReadError extends ContractError {
  constructor(
    contractAddress: string,
    functionName: string,
    args: unknown[],
    cause?: Error
  ) {
    super(
      `Failed to read from contract ${contractAddress}`,
      'CONTRACT_READ_ERROR',
      contractAddress,
      functionName,
      args,
      cause
    );
    this.name = 'ContractReadError';
  }
}

export class ContractWriteError extends ContractError {
  constructor(
    contractAddress: string,
    functionName: string,
    args: unknown[],
    cause?: Error
  ) {
    super(
      `Failed to write to contract ${contractAddress}`,
      'CONTRACT_WRITE_ERROR',
      contractAddress,
      functionName,
      args,
      cause
    );
    this.name = 'ContractWriteError';
  }
}

export class ContractNotFoundError extends ContractError {
  constructor(contractAddress: string) {
    super(
      `Contract not found at ${contractAddress}`,
      'CONTRACT_NOT_FOUND',
      contractAddress
    );
    this.name = 'ContractNotFoundError';
  }
}

// ============================================================================
// DAO ERRORS
// ============================================================================

export class DAOOperationError extends DAOError {
  public readonly daoAddress?: string;

  constructor(message: string, code: string, daoAddress?: string, context?: Record<string, unknown>, cause?: Error) {
    super(message, code, { ...context, daoAddress }, cause);
    this.name = 'DAOOperationError';
    this.daoAddress = daoAddress;
  }
}

export class DAONotFoundError extends DAOOperationError {
  constructor(daoAddress: string) {
    super(`DAO not found at ${daoAddress}`, 'DAO_NOT_FOUND', daoAddress);
    this.name = 'DAONotFoundError';
  }
}

export class DAOAlreadyExistsError extends DAOOperationError {
  constructor(daoAddress: string) {
    super(`DAO already exists at ${daoAddress}`, 'DAO_ALREADY_EXISTS', daoAddress);
    this.name = 'DAOAlreadyExistsError';
  }
}

export class DAOCreationError extends DAOOperationError {
  constructor(message: string, cause?: Error) {
    super(message, 'DAO_CREATION_ERROR', undefined, undefined, cause);
    this.name = 'DAOCreationError';
  }
}

export class PermissionError extends DAOOperationError {
  constructor(
    permission: string,
    account: string,
    daoAddress?: string,
    cause?: Error
  ) {
    super(
      `Account ${account} lacks permission: ${permission}`,
      'PERMISSION_DENIED',
      daoAddress,
      { permission, account },
      cause
    );
    this.name = 'PermissionError';
  }
}

// ============================================================================
// PROPOSAL ERRORS
// ============================================================================

export class ProposalError extends DAOError {
  public readonly proposalId?: bigint;
  public readonly daoAddress?: string;

  constructor(
    message: string,
    code: string,
    proposalId?: bigint,
    daoAddress?: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, { ...context, proposalId: proposalId?.toString(), daoAddress }, cause);
    this.name = 'ProposalError';
    this.proposalId = proposalId;
    this.daoAddress = daoAddress;
  }
}

export class ProposalNotFoundError extends ProposalError {
  constructor(proposalId: bigint, daoAddress?: string) {
    super(
      `Proposal ${proposalId} not found`,
      'PROPOSAL_NOT_FOUND',
      proposalId,
      daoAddress
    );
    this.name = 'ProposalNotFoundError';
  }
}

export class ProposalCreationError extends ProposalError {
  constructor(message: string, daoAddress?: string, cause?: Error) {
    super(message, 'PROPOSAL_CREATION_ERROR', undefined, daoAddress, undefined, cause);
    this.name = 'ProposalCreationError';
  }
}

export class InvalidProposalError extends ProposalError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'INVALID_PROPOSAL', undefined, undefined, context);
    this.name = 'InvalidProposalError';
  }
}

export class ProposalVotingError extends ProposalError {
  constructor(proposalId: bigint, message: string, cause?: Error) {
    super(
      `Failed to vote on proposal ${proposalId}: ${message}`,
      'PROPOSAL_VOTING_ERROR',
      proposalId,
      undefined,
      undefined,
      cause
    );
    this.name = 'ProposalVotingError';
  }
}

export class ProposalExecutionError extends ProposalError {
  constructor(proposalId: bigint, message: string, cause?: Error) {
    super(
      `Failed to execute proposal ${proposalId}: ${message}`,
      'PROPOSAL_EXECUTION_ERROR',
      proposalId,
      undefined,
      undefined,
      cause
    );
    this.name = 'ProposalExecutionError';
  }
}

export class ProposalAlreadyExecutedError extends ProposalError {
  constructor(proposalId: bigint) {
    super(
      `Proposal ${proposalId} has already been executed`,
      'PROPOSAL_ALREADY_EXECUTED',
      proposalId
    );
    this.name = 'ProposalAlreadyExecutedError';
  }
}

// ============================================================================
// TOKEN ERRORS
// ============================================================================

export class TokenError extends DAOError {
  public readonly tokenAddress?: string;
  public readonly account?: string;

  constructor(
    message: string,
    code: string,
    tokenAddress?: string,
    account?: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, { ...context, tokenAddress, account }, cause);
    this.name = 'TokenError';
    this.tokenAddress = tokenAddress;
    this.account = account;
  }
}

export class TokenNotFoundError extends TokenError {
  constructor(tokenAddress: string) {
    super(`Token not found at ${tokenAddress}`, 'TOKEN_NOT_FOUND', tokenAddress);
    this.name = 'TokenNotFoundError';
  }
}

export class InsufficientBalanceError extends TokenError {
  constructor(tokenAddress: string, account: string, required: bigint, available: bigint) {
    super(
      `Insufficient token balance. Required: ${required}, Available: ${available}`,
      'INSUFFICIENT_BALANCE',
      tokenAddress,
      account,
      { required: required.toString(), available: available.toString() }
    );
    this.name = 'InsufficientBalanceError';
  }
}

export class TokenTransferError extends TokenError {
  constructor(
    tokenAddress: string,
    from: string,
    to: string,
    amount: bigint,
    cause?: Error
  ) {
    super(
      `Failed to transfer ${amount} tokens from ${from} to ${to}`,
      'TOKEN_TRANSFER_ERROR',
      tokenAddress,
      from,
      { from, to, amount: amount.toString() },
      cause
    );
    this.name = 'TokenTransferError';
  }
}

export class SoulBoundTokenError extends TokenError {
  constructor(message: string, cause?: Error) {
    super(message, 'SOUL_BOUND_TOKEN_ERROR', undefined, undefined, undefined, cause);
    this.name = 'SoulBoundTokenError';
  }
}

export class TokenNotTransferableError extends SoulBoundTokenError {
  constructor(tokenAddress: string) {
    super(`Soul-bound token at ${tokenAddress} is not transferable`);
    this.name = 'TokenNotTransferableError';
  }
}

// ============================================================================
// TASK ERRORS
// ============================================================================

export class TaskError extends DAOError {
  public readonly taskId?: bigint;

  constructor(message: string, code: string, taskId?: bigint, context?: Record<string, unknown>, cause?: Error) {
    super(message, code, { ...context, taskId: taskId?.toString() }, cause);
    this.name = 'TaskError';
    this.taskId = taskId;
  }
}

export class TaskNotFoundError extends TaskError {
  constructor(taskId: bigint) {
    super(`Task ${taskId} not found`, 'TASK_NOT_FOUND', taskId);
    this.name = 'TaskNotFoundError';
  }
}

export class TaskCreationError extends TaskError {
  constructor(message: string, cause?: Error) {
    super(message, 'TASK_CREATION_ERROR', undefined, undefined, cause);
    this.name = 'TaskCreationError';
  }
}

export class BidError extends TaskError {
  public readonly bidId?: bigint;

  constructor(message: string, code: string, taskId?: bigint, bidId?: bigint, cause?: Error) {
    super(message, code, taskId, { bidId: bidId?.toString() }, cause);
    this.name = 'BidError';
    this.bidId = bidId;
  }
}

export class BidNotFoundError extends BidError {
  constructor(bidId: bigint, taskId?: bigint) {
    super(`Bid ${bidId} not found`, 'BID_NOT_FOUND', taskId, bidId);
    this.name = 'BidNotFoundError';
  }
}

// ============================================================================
// IPFS ERRORS
// ============================================================================

export class IPFSError extends DAOError {
  public readonly cid?: string;

  constructor(message: string, code: string, cid?: string, context?: Record<string, unknown>, cause?: Error) {
    super(message, code, { ...context, cid }, cause);
    this.name = 'IPFSError';
    this.cid = cid;
  }
}

export class IPFSUploadError extends IPFSError {
  constructor(message: string, cause?: Error) {
    super(`Failed to upload to IPFS: ${message}`, 'IPFS_UPLOAD_ERROR', undefined, undefined, cause);
    this.name = 'IPFSUploadError';
  }
}

export class IPFSDownloadError extends IPFSError {
  constructor(cid: string, cause?: Error) {
    super(`Failed to download from IPFS: ${cid}`, 'IPFS_DOWNLOAD_ERROR', cid, undefined, cause);
    this.name = 'IPFSDownloadError';
  }
}

export class IPFSPinError extends IPFSError {
  constructor(cid: string, cause?: Error) {
    super(`Failed to pin content: ${cid}`, 'IPFS_PIN_ERROR', cid, undefined, cause);
    this.name = 'IPFSPinError';
  }
}

// ============================================================================
// ARAGON SDK ERRORS
// ============================================================================

export class AragonSDKError extends DAOError {
  constructor(message: string, code: string, context?: Record<string, unknown>, cause?: Error) {
    super(message, code, context, cause);
    this.name = 'AragonSDKError';
  }
}

export class AragonClientError extends AragonSDKError {
  constructor(message: string, cause?: Error) {
    super(`Aragon SDK client error: ${message}`, 'ARAGON_CLIENT_ERROR', undefined, cause);
    this.name = 'AragonClientError';
  }
}

export class PluginInstallationError extends AragonSDKError {
  constructor(pluginId: string, cause?: Error) {
    super(
      `Failed to install plugin: ${pluginId}`,
      'PLUGIN_INSTALLATION_ERROR',
      { pluginId },
      cause
    );
    this.name = 'PluginInstallationError';
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class ValidationError extends DAOError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(message: string, field?: string, value?: unknown) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

export type ErrorCategory = 
  | 'chain'
  | 'transaction'
  | 'contract'
  | 'dao'
  | 'proposal'
  | 'token'
  | 'task'
  | 'ipfs'
  | 'aragon'
  | 'validation'
  | 'unknown';

export function classifyError(error: Error): ErrorCategory {
  if (error instanceof ChainError) return 'chain';
  if (error instanceof TransactionError) return 'transaction';
  if (error instanceof ContractError) return 'contract';
  if (error instanceof DAOOperationError) return 'dao';
  if (error instanceof ProposalError) return 'proposal';
  if (error instanceof TokenError) return 'token';
  if (error instanceof TaskError) return 'task';
  if (error instanceof IPFSError) return 'ipfs';
  if (error instanceof AragonSDKError) return 'aragon';
  if (error instanceof ValidationError) return 'validation';
  return 'unknown';
}

export function isRetryableError(error: Error): boolean {
  const category = classifyError(error);
  
  // Retryable errors
  if (category === 'chain') return true;
  if (category === 'transaction') {
    if (error instanceof UserRejectedError) return false;
    if (error instanceof InsufficientFundsError) return false;
    return true;
  }
  if (category === 'ipfs') return true;
  
  // Non-retryable errors
  if (category === 'validation') return false;
  if (category === 'permission') return false;
  if (error instanceof UserRejectedError) return false;
  
  return false;
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

export function extractRevertReason(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  
  const message = error.message;
  
  // Extract revert reason from common patterns
  const patterns = [
    /reverted with reason string '(.+?)'/,
    /reverted with custom error '(.+?)'/,
    /execution reverted: (.+)/,
    /VM Exception while processing transaction: reverted with reason string '(.+?)'/,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1];
  }
  
  return undefined;
}

export function createErrorFromViemError(error: unknown): DAOError {
  if (error instanceof DAOError) return error;
  
  if (!(error instanceof Error)) {
    return new DAOError(String(error), 'UNKNOWN_ERROR');
  }
  
  const message = error.message;
  const revertReason = extractRevertReason(error);
  
  // User rejection
  if (message.includes('User rejected') || message.includes('user rejected')) {
    return new UserRejectedError(error);
  }
  
  // Insufficient funds
  if (message.includes('insufficient funds')) {
    return new InsufficientFundsError(0n, 0n, error);
  }
  
  // Gas estimation
  if (message.includes('gas required exceeds') || message.includes('gas estimation failed')) {
    return new GasEstimationError(revertReason || message, error);
  }
  
  // Nonce issues
  if (message.includes('nonce')) {
    return new NonceError(0, 0, error);
  }
  
  // Transaction reverted
  if (message.includes('reverted') || message.includes('execution failed')) {
    return new TransactionRevertedError('', undefined, error);
  }
  
  // Default
  return new TransactionFailedError(revertReason || message, undefined, error);
}
