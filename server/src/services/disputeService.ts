import mongoose from 'mongoose';
import { Dispute, IDispute } from '../models/Dispute';
import { Project } from '../models/Project';
import { Notification } from '../models/Notification';

/**
 * Checks for any OPEN disputes that have exceeded the 72-hour deadline
 * and executes deterministic auto-default resolution rules without manual admin intervention.
 */
export async function checkAndApplyAutoResolutions(filter: Record<string, any> = {}): Promise<IDispute[]> {
  const now = new Date();
  const expiredDisputes = await Dispute.find({
    status: 'OPEN',
    expiresAt: { $lte: now },
    ...filter,
  }).populate('projectId', 'title category budget clientId selectedContractorId');

  const resolvedList: IDispute[] = [];

  for (const dispute of expiredDisputes) {
    try {
      const projTitle = (dispute.projectId as any)?.title || 'Project';
      let ruleApplied = '';
      let outcomeSummary = '';

      if (dispute.raisedByRole === 'CONTRACTOR') {
        // Client went silent for 72 hours -> Auto-resolve in Contractor's favor
        dispute.status = 'RESOLVED_AUTO_TIMEOUT';
        dispute.resolutionOutcome = 'RESOLVED_CONTRACTOR_FAVOR';
        dispute.resolvedAt = new Date();

        const reqAction = dispute.requestedAction;
        if (reqAction?.type === 'AUTO_PAYOUT') {
          ruleApplied = '72-Hour Client Non-Response Rule: Work completion accepted and milestone payout released to contractor.';
          outcomeSummary = `Milestone payout auto-released to contractor for "${projTitle}".`;
          // If project exists, auto-advance or mark milestone as completed
          if (dispute.projectId) {
            await Project.findByIdAndUpdate(dispute.projectId, {
              $set: { 'delayFlag.flagged': false },
            });
          }
        } else if (reqAction?.type === 'TIMELINE_EXTENSION') {
          const days = reqAction.days || 7;
          ruleApplied = `72-Hour Client Non-Response Rule: Contractor penalty-free timeline extension of ${days} days automatically granted.`;
          outcomeSummary = `${days}-day timeline extension approved without delay penalty.`;
        } else if (reqAction?.type === 'CANCEL_EXTRA_SCOPE') {
          ruleApplied = '72-Hour Client Non-Response Rule: Contractor legally freed from extra unpaid scope without penalty.';
          outcomeSummary = 'Extra scope request cancelled. Contractor to proceed with original contract only.';
        } else {
          ruleApplied = '72-Hour Client Non-Response Rule: Dispute auto-resolved in Contractor favor.';
          outcomeSummary = `Dispute auto-resolved in Contractor favor for "${projTitle}".`;
        }
      } else {
        // Contractor went silent for 72 hours -> Auto-resolve in Client's favor
        dispute.status = 'RESOLVED_AUTO_TIMEOUT';
        dispute.resolutionOutcome = 'RESOLVED_CLIENT_FAVOR';
        dispute.resolvedAt = new Date();

        const reqAction = dispute.requestedAction;
        if (reqAction?.type === 'MILESTONE_DISCOUNT') {
          const amount = reqAction.amount || 0;
          ruleApplied = `72-Hour Contractor Non-Response Rule: Milestone discount of ₹${amount.toLocaleString('en-IN')} automatically applied in client favor.`;
          outcomeSummary = `₹${amount.toLocaleString('en-IN')} discount applied to milestone payment.`;
        } else if (reqAction?.type === 'REWORK_REQUEST') {
          const days = reqAction.days || 3;
          ruleApplied = `72-Hour Contractor Non-Response Rule: Mandatory defect rework order enforced (${days} days to rectify).`;
          outcomeSummary = `Contractor required to fix defects within ${days} days before milestone release.`;
        } else if (reqAction?.type === 'WORK_ABANDONED') {
          ruleApplied = '72-Hour Contractor Non-Response Rule: Contract cancelled and unspent milestone funds refunded to client due to site abandonment.';
          outcomeSummary = `Contract cancelled and funds protected for client on "${projTitle}".`;
        } else {
          ruleApplied = '72-Hour Contractor Non-Response Rule: Dispute auto-resolved in Client favor.';
          outcomeSummary = `Dispute auto-resolved in Client favor for "${projTitle}".`;
        }
      }

      dispute.autoResolutionDetails = {
        resolvedAt: new Date(),
        ruleApplied,
        outcomeSummary,
      };
      dispute.resolutionNotes = ruleApplied;

      await dispute.save();
      resolvedList.push(dispute);

      // Automated notifications to both parties
      try {
        await Notification.create({
          recipientId: dispute.clientId,
          title: 'Dispute 72h Auto-Resolution Executed ⏱️',
          message: `${ruleApplied} for project "${projTitle}".`,
          type: 'DISPUTE_RESOLVED',
          projectId: (dispute.projectId as any)?._id || dispute.projectId,
        });

        await Notification.create({
          recipientId: dispute.contractorId,
          title: 'Dispute 72h Auto-Resolution Executed ⏱️',
          message: `${ruleApplied} for project "${projTitle}".`,
          type: 'DISPUTE_RESOLVED',
          projectId: (dispute.projectId as any)?._id || dispute.projectId,
        });
      } catch (err) {
        console.error('Notification creation error during auto-resolve:', err);
      }
    } catch (err) {
      console.error(`Error auto-resolving dispute ${dispute._id}:`, err);
    }
  }

  return resolvedList;
}
