---
id: cdkconstruct
title: CDK Construct (experimental)
sidebar_label: CDK Construct
---

AWS CDK (Cloud Development Kit) makes it possible to write infrastructure in
code using familiar languages such as JavaScript or Python, and provision via
Cloudformation. The tool is growing in popularity and so it seems fitting to
enable Next.js users to be able to deploy their apps using it. The
`NextJSLambdaEdge` construct will provision the same infrastructure as the
`serverless-component`.

It's simple to include the Next.js construct in your app, the following will
deploy your Next app using a Cloudfront domain:

```ts
// stack.ts
import { NextJSLambdaEdge } from "@sls-next/cdk-construct";
import * as cdk from "@aws-cdk/core";

export class MyStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);
    new NextJSLambdaEdge(this, "NextJsApp", {
      serverlessBuildOutDir: "./build"
    });
  }
}

// bin.ts
import * as cdk from "@aws-cdk/core";
import { Builder } from "@sls-next/lambda-at-edge";
import { MyStack } from "./stack";

// Run the serverless builder, this could be done elsewhere in your workflow
const builder = new Builder(".", "./build", {args: ['build']});

builder
  .build()
  .then(() => {
    const app = new cdk.App();
    new MyStack(app, `MyStack`);
  })
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });
```

To deploy your stack, use the `cdk` CLI as normal.

## Adding a Custom Domain

Now you've deployed your app, you'll likely want to add a custom domain:

```ts
new NextJSLambdaEdge(this, "NextJsApp", {
  serverlessBuildOutDir: "./build",
  // `Certificate.fromCertificateArn` & `HostedZone.fromHostedZoneAttributes`
  // retrieve existing resources, however you could create a new ones in your
  // stack via the relevant constructs
  domain: {
    domainName: "example.com",
    hostedZone: HostedZone.fromHostedZoneAttributes(this, "Zone", {
      hostedZoneId: "123ABC",
      zoneName: "example.com"
    }),
    certificate: Certificate.fromCertificateArn(this, "Cert", "...arn...")
  }
});
```

## Available Props

- `serverlessBuildOutDir` - the output directory of the `Builder`.
- `domain?: Object` - if you'd like to add a custom domain, provide the
  following three fields on the `domain` object.
  - `hostedZone: IHostedZone;`
  - `certificate: ICertificate;`
  - `domainName: string;`
- `memory?: number | Record<string, number>` - configure memory on all lambdas
  or individually.
- `timeout?: number | Record<string, number>` - configure timeout on all lambdas
  or individually.
- `name?: string | Record<string, string>` - configure the name of all lambdas
  or individually.
- `runtime?: lambda.Runtime | Record<string, lambda.Runtime>` - configure the runtime of all lambdas
  or individually.
- `withLogging?: boolean` - set debug logging on the lambda.
- `whiteListedCookies?: string[]` - provide a list of cookies to forward to the
  CloudFront origin.
- `defaultBehavior?: Partial<cloudfront.Behaviour>` - provide overrides for the
  default behavior
- `behaviours?: Array<cloudfront.Behaviour>` - an array of Cloudfront
  distribution behaviours.
- `invalidationPaths?: string[]` - an array of invalidation paths, by default we
  invalidate all pages found in manifest
