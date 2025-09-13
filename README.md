# 🏠 Decentralized Escrow for Home Purchases

Welcome to the future of real estate transactions! This Web3 project on the Stacks blockchain provides a decentralized escrow service for home purchases, eliminating shady intermediaries, reducing fees, and automating fund releases based on verified milestones. Buyers deposit crypto into smart contracts, which hold funds securely until off-chain verifications (like title checks, inspections, and appraisals) are confirmed via trusted oracles or verifiers. Funds release automatically to sellers—or refund if issues arise—ensuring trust and transparency in a market plagued by delays and disputes.

## ✨ Features

🔒 Secure fund escrow using crypto (STX or SIP-10 tokens)  
✅ Multi-stage verifications for title, inspection, appraisal, and closing  
🤝 Buyer and seller agreement creation with customizable terms  
📡 Oracle integration for off-chain verification submissions  
⚖️ Built-in dispute resolution with arbitrator voting  
🚀 Automatic fund release or refund on milestone completion  
🛡️ Property title represented as an NFT for ownership proof  
📊 Transparent audit trail of all transaction steps  
❌ Cancellation options with penalties for bad faith  
🌐 Modular design with 8 smart contracts for scalability and security  

## 🛠 How It Works

This project uses 8 Clarity smart contracts to handle the escrow lifecycle modularly. Here's a high-level overview:

1. **EscrowFactory.clar**: Deploys new escrow instances and manages global settings like supported tokens.  
2. **EscrowCore.clar**: The heart of each escrow—holds deposited funds, tracks milestones, and handles releases/refunds.  
3. **PropertyNFT.clar**: Mints an NFT representing the property title, transferable only on successful closing.  
4. **VerificationOracle.clar**: Accepts submissions from trusted verifiers (e.g., inspectors) for off-chain events like appraisals.  
5. **DisputeArbitrator.clar**: Manages disputes by allowing arbitrators to vote on resolutions, with staked incentives for fairness.  
6. **PaymentToken.clar**: A SIP-10 compliant fungible token contract for handling escrow payments (or integrates with STX).  
7. **MilestoneVerifier.clar**: Tracks and validates specific milestones (title search, home inspection) with required proofs.  
8. **UserRegistry.clar**: Registers buyers, sellers, and verifiers with reputation scores to prevent fraud.  

**For Buyers**  
- Register via UserRegistry and stake a small deposit for reputation.  
- Call EscrowFactory to create an escrow with the seller's address, property details, and total amount.  
- Deposit funds into EscrowCore (e.g., via transfer STX or tokens).  
- Monitor milestones in MilestoneVerifier; submit disputes if needed through DisputeArbitrator.  
- On all verifications complete, funds auto-release to seller, and you receive the PropertyNFT.  

**For Sellers**  
- Register and list your property by minting a PropertyNFT with details like address and description.  
- Agree to the escrow terms when buyer initiates.  
- Provide required docs for verifications (e.g., title deed hash).  
- Once MilestoneVerifier confirms all steps (via oracle submissions), receive funds from EscrowCore.  
- If disputes arise, participate in arbitration—losers pay penalties.  

**For Verifiers/Oracles**  
- Register as a trusted party in UserRegistry (e.g., licensed inspectors or title companies).  
- Use VerificationOracle to submit proofs (hashes or signed data) for milestones like "inspection passed."  
- Earn fees from the escrow pool for valid submissions.  
- Stake tokens in DisputeArbitrator to vote on contested verifications.  

That's it! A seamless, blockchain-powered way to buy homes without the traditional hassle. Deploy on Stacks for Bitcoin-secured transactions.