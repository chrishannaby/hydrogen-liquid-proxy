import {AppLoadContext} from '@shopify/remix-oxygen';

export async function proxyToOnlineStore(request: Request) {
  const url = 'https://checkout.hydrogen-liquid-proxy.chrishannaby.com';
  const newRequest = sanitizedRequest(url, request);

  const response = await fetch(newRequest).then(async (r) => {
    return {headers: r.headers, status: r.status, data: await r.text()};
  });

  const {origin} = new URL(request.url);

  let processedData = response.data
    .replace(
      /<meta.*name="robots".*content="noindex.*".*>|<link.*rel="canonical".*href=".*".*>|("monorailRegion":"shop_domain")|<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      (match) => {
        if (config.removeNoIndex && match.startsWith('<meta')) return '';
        if (config.updateCanonical && match.startsWith('<link'))
          return match.replace(url, origin);
        if (match.startsWith('"monorailRegion"'))
          return '"monorailRegion":"global"';
        if (config.ignoreRedirects && match.startsWith('<script'))
          return match.replace(/window\.location\.replace\([^)]*\);?/g, '');
        return match;
      },
    )
    .replace(new RegExp(url, 'g'), origin);

  const status = /<title>(.|\n)*404 Not Found(.|\n)*<\/title>/i.test(
    response.data,
  )
    ? 404
    : response.status;

  if (status === 404) {
    throw new Error('Not Found');
  }

  const headers = new Headers(response.headers);
  if (newRequest.url.includes('.js')) {
    headers.set('content-type', 'application/javascript');
  } else {
    headers.set('content-type', 'text/html');
  }
  headers.delete('content-encoding');

  return new Response(processedData, {status, headers});
}

const config = {
  removeNoIndex: false, // Set to false if you want to respect robots noindex tags
  updateCanonical: false, // Set to false if you want to respect canonical meta tags
  ignoreRedirects: false, // Set to false if you aren't redirecting to Hydrogen in your theme
};

function customHeaders(request: Request) {
  const currentHeaders = Array.from(request.headers.entries()).reduce(
    (acc, [key, value]) => {
      return {
        ...acc,
        [key]: value,
      };
    },
    {},
  );

  return new Headers({
    'X-Shopify-Client-IP': request.headers.get('X-Shopify-Client-IP') || '',
    'X-Shopify-Client-IP-Sig':
      request.headers.get('X-Shopify-Client-IP-Sig') || '',
    'User-Agent': 'Hydrogen',
    ...currentHeaders,
  });
}

async function storeUrl(context: AppLoadContext) {
  const {
    shop: {
      primaryDomain: {url},
    },
  } = await context.storefront.query(
    `#graphql
        query {
          shop {
            primaryDomain {
              url
            }
          }
        }
      `,
    {
      cache: context.storefront.CacheLong(),
    },
  );
  console.log(url);
  return url;
}

function sanitizedRequest(url: string, request: Request) {
  const {pathname, search} = new URL(request.url);
  const newUrl = url + pathname + search;
  const headers = customHeaders(request);

  return new Request(
    newUrl,
    new Request(request, {redirect: 'manual', headers}),
  );
}
