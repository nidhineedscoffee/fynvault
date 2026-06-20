export function StitchStaticPage({ slug, title }: { slug: string; title: string }) {
  return (
    <main className="min-h-screen bg-[#f7f9fb]">
      <h1 className="sr-only">{title}</h1>
      <img
        src={`/stitch/${slug}/screen.png`}
        alt={title}
        className="block h-auto min-h-screen w-full object-cover object-top"
        draggable={false}
      />
    </main>
  );
}
