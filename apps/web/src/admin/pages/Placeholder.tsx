export default function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Scaffolded route. Full page lands in its own commit per the approved plan.
      </p>
    </div>
  );
}
