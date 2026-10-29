import { PageSkeleton } from '@/components/ui/Skeleton';

// Shown inside the app shell while any signed-in page is loading (the menu stays put).
export default function Loading() {
  return <PageSkeleton />;
}
