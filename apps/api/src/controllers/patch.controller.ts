import type { Request, Response, NextFunction } from 'express';
import {
  generatePatchRequestSchema,
  verifyPatchRequestSchema,
  type GeneratePatchRequest,
  type VerifyPatchRequest,
} from '@prpilot/shared';
import {
  patchGeneratorService,
  PatchGeneratorService,
} from '../services/patchGenerator.service.js';
import {
  patchVerificationService,
  PatchVerificationService,
} from '../services/patchVerification.service.js';
import {
  analysisStorageService,
  AnalysisStorageService,
} from '../services/analysisStorage.service.js';
import { NotFoundError } from '../errors/httpError.js';

export function createPatchController(
  patchService: PatchGeneratorService = patchGeneratorService,
  verificationService: PatchVerificationService = patchVerificationService,
  storageService: AnalysisStorageService = analysisStorageService
) {
  return {
    generatePatch: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const payload = generatePatchRequestSchema.parse(req.body);
        const result = await patchService.generatePatch(payload);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },

    generatePatchForAnalysis: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { id } = req.params;
        const forceAllowClosed = req.body?.forceAllowClosed === true;

        const payload: GeneratePatchRequest = {
          analysisId: id,
          forceAllowClosed,
        };

        const validated = generatePatchRequestSchema.parse(payload);
        const result = await patchService.generatePatch(validated);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },

    getPatchForAnalysis: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { id } = req.params;
        if (!id) {
          throw new NotFoundError('Analysis ID is required');
        }

        const patch = await storageService.getPatchByAnalysisId(id);
        if (!patch) {
          throw new NotFoundError(`No patch result found for analysis ID '${id}'`);
        }

        res.status(200).json(patch);
      } catch (error) {
        next(error);
      }
    },

    verifyPatch: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const payload = verifyPatchRequestSchema.parse(req.body);
        const result = await verificationService.verifyPatch(payload);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },

    verifyPatchForAnalysis: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { id } = req.params;
        const payload: VerifyPatchRequest = {
          analysisId: id,
          runSandboxTests: req.body?.runSandboxTests === true,
          unifiedDiff: req.body?.unifiedDiff,
        };

        const validated = verifyPatchRequestSchema.parse(payload);
        const result = await verificationService.verifyPatch(validated);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },
  };
}

export const patchController = createPatchController();
