import { clerkMiddleware } from '@clerk/nextjs/server';

// Optimistic check only: unauthenticated visitors go to sign-in. Real authorization happens on the server in
// every page and action (getSession / requireHr), never here.
const isPublic = (path: string) => path.startsWith('/sign-in') || path === '/access-denied';

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req.nextUrl.pathname)) await auth.protect();
});

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
};
