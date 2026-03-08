import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params
    });

    if (!result.success) {
      return next({
        statusCode: 422,
        message: "Dados invalidos",
        details: result.error.flatten()
      });
    }

    if (result.data.body !== undefined) {
      req.body = result.data.body;
    }

    if (result.data.query !== undefined) {
      req.query = result.data.query as Request["query"];
    }

    if (result.data.params !== undefined) {
      req.params = result.data.params;
    }

    return next();
  };
}
