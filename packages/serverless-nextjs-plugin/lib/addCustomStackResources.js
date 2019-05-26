const path = require("path");
const merge = require("lodash.merge");
const clone = require("lodash.clonedeep");
const getAssetsBucketName = require("./getAssetsBucketName");
const logger = require("../utils/logger");
const loadYml = require("../utils/yml/load");

const capitaliseFirstLetter = str => str.charAt(0).toUpperCase() + str.slice(1);

// removes non-alphanumeric characters to adhere to AWS naming requirements
const normaliseResourceName = str => str.replace(/[^0-9a-zA-Z]/g, "");

const isSubPath = (parentDir, subPath) => {
  const relative = path.relative(parentDir, subPath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
};

// converts file path to a string which can be used in CF resource keys
// ./static/bar.js -> Bar
// ./static/foo/bar.js -> FooBar
const normaliseSrc = (staticDir, src) =>
  path
    .relative(staticDir, src)
    .split(path.sep)
    .filter(s => s !== "." && s !== "..")
    .map(capitaliseFirstLetter)
    .join("");

const getStaticRouteProxyResources = async function(bucketName) {
  const [staticDir, routes] = this.getPluginConfigValues("staticDir", "routes");

  if (!staticDir) {
    return {};
  }

  const baseResource = await loadYml(
    path.join(__dirname, "../resources/api-gw-proxy.yml")
  );

  const result = {
    Resources: {}
  };

  const region = this.provider.getRegion();

  // see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingBucket.html
  const bucketBaseUrl =
    region === "us-east-1"
      ? "https://s3.amazonaws.com"
      : `https://s3-${region}.amazonaws.com`;

  routes
    .filter(r => isSubPath(staticDir, r.src))
    .forEach(r => {
      const { src, path: routePath } = r;

      const bucketUrl = `${bucketBaseUrl}/${path.posix.join(bucketName, src)}`;

      let resourceName = normaliseSrc(staticDir, src);
      resourceName = path.parse(resourceName).name;
      resourceName = normaliseResourceName(resourceName);

      const resource = clone(baseResource);

      resource.Resources.ProxyResource.Properties.PathPart = routePath;
      resource.Resources.ProxyMethod.Properties.ResourceId.Ref = `${resourceName}ProxyResource`;
      resource.Resources.ProxyMethod.Properties.Integration.Uri = bucketUrl;

      result.Resources[`${resourceName}ProxyResource`] =
        resource.Resources.ProxyResource;

      result.Resources[`${resourceName}ProxyMethod`] =
        resource.Resources.ProxyMethod;

      logger.log(`Proxying ${routePath} -> ${bucketUrl}`);
    });

  return result;
};

const addCustomStackResources = async function() {
  const bucketName = getAssetsBucketName.call(this);

  if (bucketName === null) {
    return;
  }

  let assetsBucketResource = await loadYml(
    path.join(__dirname, "../resources/assets-bucket.yml")
  );

  logger.log(`Found bucket "${bucketName}"`);

  const proxyResources = await getStaticRouteProxyResources.call(
    this,
    bucketName
  );

  assetsBucketResource.Resources.NextStaticAssetsS3Bucket.Properties.BucketName = bucketName;

  this.serverless.service.resources = this.serverless.service.resources || {
    Resources: {}
  };

  merge(
    this.serverless.service.provider.coreCloudFormationTemplate,
    assetsBucketResource
  );

  merge(
    this.serverless.service.resources,
    assetsBucketResource,
    proxyResources
  );
};

module.exports = addCustomStackResources;
