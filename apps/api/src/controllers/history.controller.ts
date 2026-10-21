import type { Request, Response, NextFunction } from 'express';
import {
  analysisStorageService,
  AnalysisStorageService,
} from '../services/analysisStorage.service.js';
import { NotFoundError } from '../errors/httpError.js';

export function createHistoryController(storage: AnalysisStorageService = analysisStorageService) {
  return {
    listAnalyses: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const limitParam = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
        const offsetParam = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;

        const limit = Number.isNaN(limitParam) ? 20 : limitParam;
        const offset = Number.isNaN(offsetParam) ? 0 : offsetParam;

        const result = await storage.listAnalyses({ limit, offset });
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },

    getAnalysisById: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { id } = req.params;

        if (!id || typeof id !== 'string') {
          throw new NotFoundError('Analysis ID is required');
        }

        const record = await storage.getAnalysisById(id);
        if (!record) {
          throw new NotFoundError(`Analysis with ID '${id}' not found`);
        }

        res.status(200).json(record);
      } catch (error) {
        next(error);
      }
    },
  };
}

export const historyController = createHistoryController();
