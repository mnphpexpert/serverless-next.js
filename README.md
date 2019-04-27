# Serverless Nextjs Plugin

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/danielcondemarin/serverless-nextjs-plugin.svg?branch=master)](https://travis-ci.org/danielcondemarin/serverless-nextjs-plugin)
[![npm version](https://badge.fury.io/js/serverless-nextjs-plugin.svg)](https://badge.fury.io/js/serverless-nextjs-plugin)
[![Coverage Status](https://coveralls.io/repos/github/danielcondemarin/serverless-nextjs-plugin/badge.svg?branch=master)](https://coveralls.io/github/danielcondemarin/serverless-nextjs-plugin?branch=master)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/c0d3aa2a86cb4ce98772a02015f46314)](https://www.codacy.com/app/danielcondemarin/serverless-nextjs-plugin?utm_source=github.com&utm_medium=referral&utm_content=danielcondemarin/serverless-nextjs-plugin&utm_campaign=Badge_Grade)

A [serverless framework](https://serverless.com/) plugin to deploy nextjs apps.

The plugin targets [Next 8 serverless mode](https://nextjs.org/blog/next-8/#serverless-nextjs)

![demo](./demo.gif)

## Contents

- [Motivation](#motivation)
- [Getting Started](#getting-started)
- [Hosting static assets](#hosting-static-assets)
- [Deploying](#deploying)
- [Deploying a single page](#deploying-a-single-page)
- [Overriding page configuration](#overriding-page-configuration)
- [Custom page routing](#custom-page-routing)
- [Custom error page](#custom-error-page)
- [Examples](#examples)
- [Contributing](#contributing)

## Motivation

Next 8 released [official support](https://nextjs.org/blog/next-8/#serverless-nextjs) for serverless! It doesn't work out of the box with AWS Lambdas, instead, next provides a low level API which this plugin uses to deploy the serverless pages.

Nextjs serverless page handler signature:

```js
exports.render = function(req, res) => {...}
```

AWS Lambda handler:

```js
exports.handler = function(event, context, callback) {...}
```

A compat layer between the nextjs page bundles and AWS Lambda is added at build time:

```js
const page = require(".next/serverless/pages/somePage.js");

module.exports.render = (event, context, callback) => {
  const { req, res } = compatLayer(event, callback);
  page.render(req, res);
};
```

## Getting started

### Installing

`npm install --save-dev serverless-nextjs-plugin`

The plugin only needs to know where your `next.config.js` file is located. Using your next configuration it will automatically build the application and compile the pages using the target: `serverless`.

Note it expects `nextConfigDir` to be a directory and not the actual file path.

```
nextApp
│   next.config.js
│   serverless.yml
└───pages
│   │   home.js
│   │   about.js
│   │   admin.js
```

Edit the serverless.yml and add:

```yml
plugins:
  - serverless-nextjs-plugin

custom:
  serverless-nextjs:
    nextConfigDir: "./"

package:
  exclude:
    - ./**
```

You can exclude everything. The plugin makes sure the page handlers are included in the artifacts.

## Hosting static assets

If you don't want to manage uploading the next static assets yourself, like uploading them to a CDN, the plugin can do this for you by hosting the asset files on S3.

The easiest way is to use a [valid bucket URL](https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingBucket.html#access-bucket-intro) in the `assetPrefix` field of your next configuration:

```js
// next.config.js
module.exports = {
  assetPrefix: "https://s3.amazonaws.com/your-bucket-name"
};
```

The plugin will create a new S3 Bucket using the parsed name. On deployment, static assets will be uploaded to the bucket provisioned.

Alternatively, if you just want the assets to get uploaded to S3, you can provide the bucket name via the plugin config:

```yml
# serverless.yml
plugins:
  - serverless-nextjs-plugin

custom:
  serverless-nextjs:
    nextConfigDir: "./"
    assetsBucketName: "your-bucket-name"
```

With this approach you could have a CloudFront distribution in front of the bucket and use a custom domain in the assetPrefix.

| Plugin config key | Default Value | Description                                                                                                                                                                                                                      |
| ----------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| assetsBucketName  | \<empty\>     | Creates an S3 bucket with the name provided. The bucket will be used for uploading next static assets                                                                                                                            |
| staticDir         | \<empty\>     | Directory with static assets to be uploaded to S3, typically a directory named `static`, but it can be any other name. Requires a bucket provided via the `assetPrefix` described above or the `assetsBucketName` plugin config. |
| uploadBuildAssets | true          | In the unlikely event that you only want to upload the `staticDir`, set this to `false`                                                                                                                                          |

## Deploying

`serverless deploy`

When running `serverless deploy` all your next pages will be automatically compiled, packaged and deployed.

The Lambda functions created for each page have by default the following configuration:

```yml
handler: /path/to/page/handler.render
events:
  - http:
      path: pageName # home, about, etc. Unless is the index page which is served at /
      method: get
  - http:
      path: pageName # home, about, etc. Unless is the index page which is served at /
      method: head
```

If you need to change the default configuration, such as `memorySize`, `timeout` etc. use the top level `provider` which will override the functions configuration. For example, to change the memorySize to 512MB:

```yml
provider:
  name: aws
  runtime: nodejs8.10
  memorySize: 512
  ...
```

See [this](https://serverless.com/framework/docs/providers/aws/guide/functions#configuration) for more information.

## Deploying a single page

If you need to deploy just one of your pages, simply run:

```console
serverless deploy function --function pageFunctionName
```

where `pageFunctionName` will be the page file name + `"Page"`. For example, to deploy `pages/home.js`, you can run:

```console
serverless deploy function --function homePage
```

## Overriding page configuration

You may want to have a different configuration for one or more of your page functions. This is possible by setting the `pageConfig` key in the plugin config:

```yml
plugins:
  - serverless-nextjs-plugin

custom:
  serverless-nextjs:
    nextConfigDir: ./
    pageConfig:
      about:
        memorySize: 512 # default is 1024
      home:
        timeout: 10 # default is 6
```

The example above will deploy the `about` page function with a smaller `memorySize` and the home page with a higher `timeout` than the default values.

You can set any function property described [here](https://serverless.com/framework/docs/providers/aws/guide/functions#configuration). The values provided will be merged onto the plugin defaults.

## Custom page routing

The default page routes follow the same convention as next `useFileSystemPublicRoutes` documented [here](https://nextjs.org/docs/#routing).

E.g.

| page                        | path                |
| --------------------------- | ------------------- |
| pages/index.js              | /                   |
| pages/post.js               | /post               |
| pages/blog/index.js         | /blog               |
| pages/categories/uno/dos.js | /categories/uno/dos |

You may want to serve your page from a different path. This is possible by setting your own http path in the `pageConfig`. For example for `pages/post.js`:

```js
class Post extends React.Component {
  static async getInitialProps({ query }) {
    return {
      slug: query.slug
    };
  }
  render() {
    return <h1>Post page: {this.props.slug}</h1>;
  }
}

export default Post;
```

```yml
plugins:
  - serverless-nextjs-plugin

custom:
  serverless-nextjs:
    nextConfigDir: ./
    pageConfig:
      post:
        events:
          - http:
              path: post/{slug}
              request:
                parameters:
                  paths:
                    slug: true
```

## Custom error page

404 or 500 errors are handled both client and server side by a default component `error.js`, same as documented [here](https://github.com/zeit/next.js/#custom-error-handling).

Simply add `pages/_error.js`:

```js
class Error extends React.Component {
  static getInitialProps({ res, err }) {
    const statusCode = res ? res.statusCode : err ? err.statusCode : null;
    return { statusCode };
  }

  render() {
    return (
      <p>
        {this.props.statusCode
          ? `An error ${this.props.statusCode} occurred on server (╯°□°)╯︵ ┻━┻`
          : "An error occurred on client"}
      </p>
    );
  }
}

export default Error;
```

## Examples

See the `examples/` directory.

## Contributing

Please see the [contributing](./CONTRIBUTING.md) guide.
