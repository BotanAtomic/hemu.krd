// This fallback cannot resume a native PKCE attempt. Discard any provider
// query/fragment without reading, forwarding, storing or displaying its data.
history.replaceState(null, '', location.pathname);
