/**
 * Setup express server.
 */

import express, { NextFunction, Request, Response } from 'express'
import helmet from 'helmet'
import morgan from 'morgan'

import 'express-async-errors'

import EnvVars from '@src/common/EnvVars'
import HttpStatusCodes from '@src/common/HttpStatusCodes'
import { NodeEnvs } from '@src/common/misc'
import BaseRouter from '@src/routes'

import { LatitudeError, UnprocessableEntityError } from './common/errors'

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

if (EnvVars.NODE_ENV === NodeEnvs.Dev.valueOf()) {
  app.use(morgan('dev'))
}

if (EnvVars.NODE_ENV === NodeEnvs.Production.valueOf()) {
  // Apache style common logs
  app.use(morgan('common'))
  app.use(helmet())
}

// Add APIs, must be after middleware
app.use('/', BaseRouter)

// Add error handler
app.use((err: Error, _: Request, res: Response, __: NextFunction) => {
  if (EnvVars.NODE_ENV !== NodeEnvs.Test.valueOf()) {
    console.error(err.message, true)
  }

  if (err instanceof UnprocessableEntityError) {
    return res.status(err.statusCode).json({
      name: err.name,
      message: err.message,
      details: err.details,
    })
  } else if (err instanceof LatitudeError) {
    return res.status(err.statusCode).json({
      message: err.message,
      details: err.details,
    })
  } else {
    return res
      .status(HttpStatusCodes.BAD_REQUEST)
      .json({ message: err.message })
  }
})

export default app
