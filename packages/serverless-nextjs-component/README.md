# Serverless Nextjs Component

![logo](./logo.gif)

A zero configuration Nextjs 9.0 [serverless component](https://github.com/serverless-components/) with full feature parity.

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/danielcondemarin/serverless-next.js.svg?branch=master)](https://travis-ci.org/danielcondemarin/serverless-next.js)
[![Financial Contributors on Open Collective](https://opencollective.com/serverless-nextjs-plugin/all/badge.svg?label=financial+contributors)](https://opencollective.com/serverless-nextjs-plugin) [![npm version](https://badge.fury.io/js/serverless-next.js.svg)](https://badge.fury.io/js/serverless-next.js)
[![Coverage Status](https://coveralls.io/repos/github/danielcondemarin/serverless-next.js/badge.svg?branch=master)](https://coveralls.io/github/danielcondemarin/serverless-next.js?branch=master)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/c0d3aa2a86cb4ce98772a02015f46314)](https://www.codacy.com/app/danielcondemarin/serverless-nextjs-plugin?utm_source=github.com&utm_medium=referral&utm_content=danielcondemarin/serverless-nextjs-plugin&utm_campaign=Badge_Grade)

## Contents

- [Motivation](#motivation)
- [Design principles](#design-principles)
- [Features](#features)
- [Getting started](#getting-started)
- [Custom domain name](#custom-domain-name)
- [Architecture](#architecture)
- [FAQ](#faq)

### Motivation

Since Nextjs 8.0, [serverless mode](https://nextjs.org/blog/next-8#serverless-nextjs) was introduced which provides a new low level API which projects like this can use to deploy onto different cloud providers. This project is a better version of the [serverless plugin](https://github.com/danielcondemarin/serverless-next.js/tree/master/packages/serverless-nextjs-plugin) which focuses on addressing core issues like [next 9 support](https://github.com/danielcondemarin/serverless-nextjs-plugin/issues/101), [better development experience](https://github.com/danielcondemarin/serverless-nextjs-plugin/issues/59), [the 200 CloudFormation resource limit](https://github.com/danielcondemarin/serverless-nextjs-plugin/issues/17) and [performance](https://github.com/danielcondemarin/serverless-nextjs-plugin/issues/13).

### Design principles

1. Zero configuration by default

There is no configuration needed. You can extend defaults based on your application needs.

2. Feature parity with nextjs

Users of this component should be able to use nextjs development tooling, aka `next dev`. It is the component's job to deploy your application ensuring parity with all of next's features we know and love.

3. Fast deployments / no CloudFormation resource limits.

With a simplified architecture and no use of CloudFormation, there are no limits to how many pages you can have in your application, plus deployment times are very fast! with the exception of CloudFront propagation times of course.

### Features

- [x] [Server side rendered pages at the Edge](https://github.com/zeit/next.js#fetching-data-and-component-lifecycle).
      Pages that need server side compute to render are hosted on Lambda@Edge. The component takes care of all the routing for you so there is no configuration needed. Because rendering happens at the CloudFront edge locations latency is very low!
- [x] [API Routes](https://nextjs.org/docs#api-routes).
      Similarly to the server side rendered pages, API requests are also served from the CloudFront edge locations using Lambda@Edge.
- [x] [Dynamic pages / route segments](https://github.com/zeit/next.js/#dynamic-routing).
- [x] [Automatic prerendering](https://github.com/zeit/next.js/#automatic-prerendering).
      Statically optimised pages compiled by next are served from CloudFront edge locations with low latency and cost.
- [x] [Client assets](https://github.com/zeit/next.js/#cdn-support-with-asset-prefix).
      Nextjs build assets `/_next/*` served from CloudFront.
- [x] [User static / public folders](https://github.com/zeit/next.js#static-file-serving-eg-images).
      Any of your assets in the static or public folders are uploaded to S3 and served from CloudFront automatically.

### Getting started

Install the next.js component:

`npm install serverless-next.js --save-dev`

Add your next application to the serverless.yml:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
```

Set your aws credentials in a `.env` file:

```bash
AWS_ACCESS_KEY_ID=accesskey
AWS_SECRET_ACCESS_KEY=sshhh
```

And simply deploy:

```bash
$ serverless
```

### Custom domain name

In most cases you wouldn't want to use CloudFront's distribution domain to access your application. Instead, you can specify a custom domain name.

First, make sure you've purchased your domain within Route53. Then simply configure your `subdomain` and `domain` like the example below.

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    domain: ["www", "example.com"] # [ sub-domain, domain ]
```

### Custom bucket name

To override the default generated bucket name provided by Serverless, configure your `bucketName` like the example below:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    bucketName: my-next-application
```

### Architecture

![architecture](./arch_no_grid.png)

Four Cache Behaviours are created in CloudFront.

The first two `_next/*` and `static/*` forward the requests to S3.

The third is associated to a lambda function which is responsible for handling three types of requests.

1. Server side rendered page. Any page that defines `getInitialProps` method will be rendered at this level and the response is returned immediately to the user.

2. Statically optimised page. Requests to pages that were pre-compiled by next to HTML are forwarded to S3.

3. Public resources. Requests to root level resources like `/robots.txt`, `/favicon.ico`, `/manifest.json`, etc. These are forwarded to S3.

The reason why 2. and 3. have to go through Lambda@Edge first is because the routes don't conform to a pattern like `_next/*` or `static/*`. Also, one cache behaviour per route is a bad idea because CloudFront only allows [25 per distribution](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html#limits-web-distributions).

The fourth cache behaviour handles next API requests `api/*`.

### FAQ

#### How do I interact with other AWS Services within my app?

See `examples/dynamodb-crud` for an example Todo application that interacts with DynamoDB.

#### Should I use the [serverless-nextjs-plugin](https://github.com/danielcondemarin/serverless-nextjs-plugin/tree/master/packages/serverless-nextjs-plugin) or this component?

Users are encouraged to use this component instead of the `serverless-nextjs-plugin`. This component was built and designed using lessons learned from the serverless plugin.

#### [CI/CD] A new CloudFront distribution is created on every CI build. I wasn't expecting that

You need to commit your application state in source control. That is the files under the `.serverless` directory.
The serverless team is currently working on remote state storage so this won't be necessary in the future.
