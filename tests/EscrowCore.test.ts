import { describe, it, expect, beforeEach } from "vitest";
import { uintCV, principalCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_STATE = 101;
const ERR_INVALID_AMOUNT = 104;
const ERR_INVALID_PARTY = 105;
const ERR_MILESTONE_NOT_FOUND = 106;
const ERR_ALREADY_VERIFIED = 107;
const ERR_DISPUTE_ACTIVE = 108;
const ERR_NO_DISPUTE = 109;
const ERR_TIME_EXPIRED = 111;
const ERR_INVALID_DEADLINE = 112;
const ERR_ORACLE_NOT_REGISTERED = 115;
const ERR_INVALID_RESOLUTION = 118;
const ERR_VOTE_ALREADY_CAST = 119;

const STATE_INITIATED = 0;
const STATE_FUNDED = 1;
const STATE_DISPUTED = 3;
const STATE_CLOSED = 4;
const STATE_CANCELLED = 5;

interface Milestone {
  description: string;
  verified: boolean;
  verifier: string;
  timestamp: number;
}

interface Dispute {
  active: boolean;
  votesForBuyer: number;
  votesForSeller: number;
  resolved: boolean;
  resolution: boolean;
}

interface ArbitratorVote {
  voter: string;
  vote: boolean;
}

interface Result {
  ok: boolean;
  value: boolean | number;
}

class EscrowCoreMock {
  state: {
    escrowState: number;
    buyer: string;
    seller: string;
    escrowAmount: number;
    depositDeadline: number;
    verificationDeadline: number;
    propertyNftId: number;
    oracleContract: string;
    arbitratorContract: string;
    disputeResolution: boolean;
    refundPercentage: number;
    milestones: Map<number, Milestone>;
    disputes: Map<number, Dispute>;
    oracleRegistrations: Map<string, boolean>;
    arbitratorVotes: Map<number, ArbitratorVote>;
  } = {
    escrowState: STATE_INITIATED,
    buyer: "ST1BUYER",
    seller: "ST1SELLER",
    escrowAmount: 0,
    depositDeadline: 0,
    verificationDeadline: 0,
    propertyNftId: 0,
    oracleContract: "ST1ORACLE",
    arbitratorContract: "ST1ARBITRATOR",
    disputeResolution: false,
    refundPercentage: 100,
    milestones: new Map(),
    disputes: new Map(),
    oracleRegistrations: new Map(),
    arbitratorVotes: new Map(),
  };
  blockHeight: number = 100;
  caller: string = "ST1CALLER";
  stxTransfers: Array<{ amount: number; from: string; to: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      escrowState: STATE_INITIATED,
      buyer: "ST1BUYER",
      seller: "ST1SELLER",
      escrowAmount: 0,
      depositDeadline: 0,
      verificationDeadline: 0,
      propertyNftId: 0,
      oracleContract: "ST1ORACLE",
      arbitratorContract: "ST1ARBITRATOR",
      disputeResolution: false,
      refundPercentage: 100,
      milestones: new Map(),
      disputes: new Map(),
      oracleRegistrations: new Map(),
      arbitratorVotes: new Map(),
    };
    this.blockHeight = 100;
    this.caller = "ST1CALLER";
    this.stxTransfers = [];
  }

  initializeEscrow(
    newBuyer: string,
    newSeller: string,
    amount: number,
    depDeadline: number,
    verDeadline: number,
    nftId: number,
    oracle: string,
    arbitrator: string
  ): Result {
    if (newBuyer === this.caller || newSeller === this.caller) return { ok: false, value: ERR_INVALID_PARTY };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (depDeadline <= this.blockHeight) return { ok: false, value: ERR_INVALID_DEADLINE };
    if (verDeadline <= this.blockHeight) return { ok: false, value: ERR_INVALID_DEADLINE };
    if (this.state.escrowState !== STATE_INITIATED) return { ok: false, value: ERR_INVALID_STATE };
    this.state.buyer = newBuyer;
    this.state.seller = newSeller;
    this.state.escrowAmount = amount;
    this.state.depositDeadline = depDeadline;
    this.state.verificationDeadline = verDeadline;
    this.state.propertyNftId = nftId;
    this.state.oracleContract = oracle;
    this.state.arbitratorContract = arbitrator;
    return { ok: true, value: true };
  }

  depositFunds(): Result {
    if (this.state.escrowState !== STATE_INITIATED) return { ok: false, value: ERR_INVALID_STATE };
    if (this.blockHeight > this.state.depositDeadline) return { ok: false, value: ERR_TIME_EXPIRED };
    if (this.caller !== this.state.buyer) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.stxTransfers.push({ amount: this.state.escrowAmount, from: this.caller, to: "contract" });
    this.state.escrowState = STATE_FUNDED;
    return { ok: true, value: true };
  }

  addMilestone(id: number, description: string): Result {
    if (this.state.escrowState !== STATE_FUNDED) return { ok: false, value: ERR_INVALID_STATE };
    if (this.caller !== this.state.seller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.milestones.has(id)) return { ok: false, value: ERR_ALREADY_VERrified };
    this.state.milestones.set(id, { description, verified: false, verifier: this.caller, timestamp: 0 });
    return { ok: true, value: true };
  }

  verifyMilestone(id: number): Result {
    if (this.state.escrowState !== STATE_FUNDED) return { ok: false, value: ERR_INVALID_STATE };
    if (this.blockHeight > this.state.verificationDeadline) return { ok: false, value: ERR_TIME_EXPIRED };
    if (!this.state.milestones.has(id)) return { ok: false, value: ERR_MILESTONE_NOT_FOUND };
    if (!this.state.oracleRegistrations.get(this.caller)) return { ok: false, value: ERR_ORACLE_NOT_REGISTERED };
    const milestone = this.state.milestones.get(id)!;
    if (milestone.verified) return { ok: false, value: ERR_ALREADY_VERIFIED };
    this.state.milestones.set(id, { ...milestone, verified: true, verifier: this.caller, timestamp: this.blockHeight });
    if (Array.from(this.state.milestones.values()).every(m => m.verified)) {
      this.stxTransfers.push({ amount: this.state.escrowAmount, from: "contract", to: this.state.seller });
      this.state.escrowState = STATE_CLOSED;
    }
    return { ok: true, value: true };
  }

  initiateDispute(disputeId: number): Result {
    if (this.state.escrowState !== STATE_FUNDED) return { ok: false, value: ERR_INVALID_STATE };
    if (this.caller !== this.state.buyer && this.caller !== this.state.seller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.disputes.has(disputeId)) return { ok: false, value: ERR_DISPUTE_ACTIVE };
    this.state.disputes.set(disputeId, { active: true, votesForBuyer: 0, votesForSeller: 0, resolved: false, resolution: false });
    this.state.escrowState = STATE_DISPUTED;
    return { ok: true, value: true };
  }

  voteOnDispute(disputeId: number, voteForBuyer: boolean): Result {
    if (this.state.escrowState !== STATE_DISPUTED) return { ok: false, value: ERR_INVALID_STATE };
    if (this.caller !== this.state.arbitratorContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!this.state.disputes.has(disputeId)) return { ok: false, value: ERR_NO_DISPUTE };
    const dispute = this.state.disputes.get(disputeId)!;
    if (!dispute.active) return { ok: false, value: ERR_NO_DISPUTE };
    if (this.state.arbitratorVotes.has(disputeId)) return { ok: false, value: ERR_VOTE_ALREADY_CAST };
    this.state.arbitratorVotes.set(disputeId, { voter: this.caller, vote: voteForBuyer });
    if (voteForBuyer) {
      dispute.votesForBuyer += 1;
    } else {
      dispute.votesForSeller += 1;
    }
    this.state.disputes.set(disputeId, dispute);
    if (dispute.votesForBuyer + dispute.votesForSeller >= 3) {
      const resolution = dispute.votesForBuyer > dispute.votesForSeller;
      this.state.disputes.set(disputeId, { ...dispute, resolved: true, resolution, active: false });
      this.state.escrowState = STATE_CLOSED;
      this.stxTransfers.push({
        amount: this.state.escrowAmount,
        from: "contract",
        to: resolution ? this.state.buyer : this.state.seller
      });
    }
    return { ok: true, value: true };
  }

  cancelEscrow(): Result {
    if (this.state.escrowState !== STATE_INITIATED) return { ok: false, value: ERR_INVALID_STATE };
    if (this.caller !== this.state.buyer && this.caller !== this.state.seller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.escrowState = STATE_CANCELLED;
    return { ok: true, value: true };
  }

  registerOracle(oracle: string): Result {
    if (this.caller !== this.state.oracleContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.oracleRegistrations.set(oracle, true);
    return { ok: true, value: true };
  }

  setRefundPercentage(percentage: number): Result {
    if (percentage < 0 || percentage > 100) return { ok: false, value: ERR_INVALID_RESOLUTION };
    if (this.caller !== this.state.seller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.refundPercentage = percentage;
    return { ok: true, value: true };
  }

  getEscrowState(): number {
    return this.state.escrowState;
  }

  getBuyer(): string {
    return this.state.buyer;
  }

  getSeller(): string {
    return this.state.seller;
  }

  getEscrowAmount(): number {
    return this.state.escrowAmount;
  }

  getMilestone(id: number): Milestone | undefined {
    return this.state.milestones.get(id);
  }

  getDispute(id: number): Dispute | undefined {
    return this.state.disputes.get(id);
  }

  isOracleRegistered(oracle: string): boolean {
    return this.state.oracleRegistrations.get(oracle) || false;
  }

  getRefundPercentage(): number {
    return this.state.refundPercentage;
  }
}

describe("EscrowCore", () => {
  let contract: EscrowCoreMock;

  beforeEach(() => {
    contract = new EscrowCoreMock();
    contract.reset();
  });

  it("initializes escrow successfully", () => {
    contract.caller = "ST1INIT";
    const result = contract.initializeEscrow("ST2BUYER", "ST2SELLER", 1000, 200, 300, 1, "ST2ORACLE", "ST2ARBITRATOR");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getBuyer()).toBe("ST2BUYER");
    expect(contract.getSeller()).toBe("ST2SELLER");
    expect(contract.getEscrowAmount()).toBe(1000);
  });

  it("rejects initialization with invalid amount", () => {
    contract.caller = "ST1INIT";
    const result = contract.initializeEscrow("ST2BUYER", "ST2SELLER", 0, 200, 300, 1, "ST2ORACLE", "ST2ARBITRATOR");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_AMOUNT);
  });

  it("deposits funds successfully", () => {
    contract.caller = "ST1INIT";
    contract.initializeEscrow("ST1BUYER", "ST1SELLER", 1000, 150, 250, 1, "ST1ORACLE", "ST1ARBITRATOR");
    contract.caller = "ST1BUYER";
    const result = contract.depositFunds();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getEscrowState()).toBe(STATE_FUNDED);
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1BUYER", to: "contract" }]);
  });

  it("rejects deposit by non-buyer", () => {
    contract.caller = "ST1INIT";
    contract.initializeEscrow("ST1BUYER", "ST1SELLER", 1000, 150, 250, 1, "ST1ORACLE", "ST1ARBITRATOR");
    contract.caller = "ST1SELLER";
    const result = contract.depositFunds();
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("adds milestone successfully", () => {
    contract.caller = "ST1INIT";
    contract.initializeEscrow("ST1BUYER", "ST1SELLER", 1000, 150, 250, 1, "ST1ORACLE", "ST1ARBITRATOR");
    contract.caller = "ST1BUYER";
    contract.depositFunds();
    contract.caller = "ST1SELLER";
    const result = contract.addMilestone(1, "Title Verification");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const milestone = contract.getMilestone(1);
    expect(milestone?.description).toBe("Title Verification");
    expect(milestone?.verified).toBe(false);
  });

  it("rejects add milestone by non-seller", () => {
    contract.caller = "ST1INIT";
    contract.initializeEscrow("ST1BUYER", "ST1SELLER", 1000, 150, 250, 1, "ST1ORACLE", "ST1ARBITRATOR");
    contract.caller = "ST1BUYER";
    contract.depositFunds();
    contract.caller = "ST1BUYER";
    const result = contract.addMilestone(1, "Title Verification");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("verifies milestone successfully", () => {
    contract.caller = "ST1INIT";
    contract.initializeEscrow("ST1BUYER", "ST1SELLER", 1000, 150, 250, 1, "ST1ORACLE", "ST1ARBITRATOR");
    contract.caller = "ST1BUYER";
    contract.depositFunds();
    contract.caller = "ST1SELLER";
    contract.addMilestone(1, "Inspection");
    contract.caller = "ST1ORACLE";
    contract.registerOracle("ST1VERIFIER");
    contract.caller = "ST1VERIFIER";
    const result = contract.verifyMilestone(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const milestone = contract.getMilestone(1);
    expect(milestone?.verified).toBe(true);
    expect(milestone?.verifier).toBe("ST1VERIFIER");
  });

  it("releases funds after all milestones verified", () => {
    contract.caller = "ST1INIT";
    contract.initializeEscrow("ST1BUYER", "ST1SELLER", 1000, 150, 250, 1, "ST1ORACLE", "ST1ARBITRATOR");
    contract.caller = "ST1BUYER";
    contract.depositFunds();
    contract.caller = "ST1SELLER";
    contract.addMilestone(1, "Appraisal");
    contract.caller = "ST1ORACLE";
    contract.registerOracle("ST1VERIFIER");
    contract.caller = "ST1VERIFIER";
    contract.verifyMilestone(1);
    expect(contract.getEscrowState()).toBe(STATE_CLOSED);
    expect(contract.stxTransfers).toHaveLength(2);
    expect(contract.stxTransfers[1]).toEqual({ amount: 1000, from: "contract", to: "ST1SELLER" });
  });

  it("initiates dispute successfully", () => {
    contract.caller = "ST1INIT";
    contract.initializeEscrow("ST1BUYER", "ST1SELLER", 1000, 150, 250, 1, "ST1ORACLE", "ST1ARBITRATOR");
    contract.caller = "ST1BUYER";
    contract.depositFunds();
    const result = contract.initiateDispute(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getEscrowState()).toBe(STATE_DISPUTED);
    const dispute = contract.getDispute(1);
    expect(dispute?.active).toBe(true);
  });

  it("cancels escrow successfully", () => {
    contract.caller = "ST1INIT";
    contract.initializeEscrow("ST1BUYER", "ST1SELLER", 1000, 150, 250, 1, "ST1ORACLE", "ST1ARBITRATOR");
    contract.caller = "ST1BUYER";
    const result = contract.cancelEscrow();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getEscrowState()).toBe(STATE_CANCELLED);
  });

  it("registers oracle successfully", () => {
    contract.caller = "ST1ORACLE";
    const result = contract.registerOracle("ST2NEWORACLE");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.isOracleRegistered("ST2NEWORACLE")).toBe(true);
  });

  it("sets refund percentage successfully", () => {
    contract.caller = "ST1SELLER";
    const result = contract.setRefundPercentage(50);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getRefundPercentage()).toBe(50);
  });

  it("rejects invalid refund percentage", () => {
    contract.caller = "ST1SELLER";
    const result = contract.setRefundPercentage(101);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_RESOLUTION);
  });

  it("uses Clarity types for parameters", () => {
    const amount = uintCV(1000);
    const buyer = principalCV("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM");
    expect(amount.value).toEqual(BigInt(1000));
    expect(buyer.value).toBe("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM");
  });
});