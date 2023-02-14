import { Injectable, Module, NestMiddleware } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AcelaCore } from '..'

// import { buildSchema, GraphQLScalarType } from 'graphql'
// import { createSchema, createYoga } from 'graphql-yoga'
// import { JSONResolver} from "graphql-scalars"
// import { CoreService } from '../../services'
import { AppController } from './app.controller'
import { AppModule } from './app.module'


export const appContainer: { self: AcelaCore  } = {} as any



/**
 * see api requirements here https://github.com/3speaknetwork/research/discussions/3
 */
export class ApiModule {
  constructor(
    private readonly selfInput:  AcelaCore,
    private readonly listenPort: number,
  ) {
    appContainer.self = selfInput;
  }

  public async listen() {
    const app = await NestFactory.create(AppModule, {
      cors: true,
    })

    // const yoga = createYoga({
    //   schema,
    //   graphqlEndpoint: `/api/v1/graphql`,
    //   graphiql: {
    //     //NOTE: weird string is for formatting on UI to look OK
    //     defaultQuery: /* GraphQL */ "" +
    //       "query MyQuery {\n" +
    //       " latestFeed(limit: 10) {\n" +
    //       "   items {\n" +
    //       "      ... on HivePost {\n" +
    //       "        parent_permlink\n" +
    //       "        parent_author\n" +
    //       "        title\n" +
    //       "        body\n" +
    //       "      }\n" +
    //       "    }\n"+
    //       "  }\n"
    //   },
    // })
 
    // app.use('/api/v1/graphql', yoga)
    // Pass it into a server to hook into request handlers.

    app.enableShutdownHooks()

    await app.listen(this.listenPort)
  }
}
