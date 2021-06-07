import { addDefaultLocaleToPath, dropLocaleFromPath } from "./locale";
import { matchDynamicRoute } from "../match";
import { notFoundData } from "./notfound";
import { DataRoute, PageManifest, RoutesManifest, StaticRoute } from "../types";

/*
 * Get page name from data route
 */
const normaliseDataUri = (uri: string, buildId: string) => {
  const prefix = `/_next/data/${buildId}`;
  if (!uri.startsWith(prefix)) {
    return uri;
  }
  return uri
    .slice(prefix.length)
    .replace(/\.json$/, "")
    .replace(/^(\/index)?$/, "/");
};

/*
 * Get full data route uri from page name
 */
const fullDataUri = (uri: string, buildId: string) => {
  const prefix = `/_next/data/${buildId}`;
  if (uri === "/") {
    return `${prefix}/index.json`;
  }
  return `${prefix}${uri}.json`;
};

/*
 * Handles a data route
 */
export const handleDataReq = (
  uri: string,
  manifest: PageManifest,
  routesManifest: RoutesManifest,
  isPreview: boolean
): DataRoute | StaticRoute => {
  const { buildId, pages } = manifest;
  const localeUri = addDefaultLocaleToPath(
    normaliseDataUri(uri, buildId),
    routesManifest
  );
  if (pages.ssg.nonDynamic[localeUri] && !isPreview) {
    const ssg = pages.ssg.nonDynamic[localeUri];
    const route = ssg.srcRoute ?? localeUri;
    return {
      isData: true,
      isStatic: true,
      file: fullDataUri(localeUri, buildId),
      page: `pages${dropLocaleFromPath(route, routesManifest)}.js`,
      revalidate: ssg.initialRevalidateSeconds
    };
  }
  if (pages.ssr.nonDynamic[localeUri]) {
    return {
      isData: true,
      isRender: true,
      page: pages.ssr.nonDynamic[localeUri]
    };
  }

  const dynamic = matchDynamicRoute(localeUri, pages.dynamic);

  const dynamicSSG = dynamic && pages.ssg.dynamic[dynamic];
  if (dynamicSSG) {
    return {
      isData: true,
      isStatic: true,
      file: fullDataUri(localeUri, buildId),
      page: `pages${dropLocaleFromPath(dynamic as string, routesManifest)}.js`,
      fallback: dynamicSSG.fallback
    };
  }
  const dynamicSSR = dynamic && pages.ssr.dynamic[dynamic];
  if (dynamicSSR) {
    return {
      isData: true,
      isRender: true,
      page: dynamicSSR
    };
  }

  return notFoundData(uri, manifest, routesManifest);
};
