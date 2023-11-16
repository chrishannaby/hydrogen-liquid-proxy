import {useLoaderData} from '@remix-run/react';
import {LoaderFunctionArgs} from '@shopify/remix-oxygen';

export async function loader({request, context, params}: LoaderFunctionArgs) {
  if (params.page !== 'contact') {
    throw new Response(null, {
      status: 404,
    });
  }
  return null;
}

export default function ContactPage() {
  const data = useLoaderData();
  return (
    <div>
      <h1>Contact Page</h1>
    </div>
  );
}
