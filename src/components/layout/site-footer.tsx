import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-lg px-4 pb-3 pt-6 text-center text-xs text-gray-400 md:max-w-3xl lg:max-w-6xl">
      <Link href="/disclaimer" className="underline-offset-2 hover:text-gray-600 hover:underline">
        Note legali
      </Link>
    </footer>
  );
}
