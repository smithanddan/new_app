const demoSources = [
  { name: "Demo Lab", type: "labs", status: "enabled", frequency: "daily" },
  { name: "Demo Shop", type: "products", status: "paused", frequency: "daily" }
];

export default function SourcesPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold">Источники</h1>
        <p className="mt-2 text-slate-600">Сайты, каталоги, лаборатории, магазины и конкуренты.</p>
        <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Тип</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Расписание</th>
              </tr>
            </thead>
            <tbody>
              {demoSources.map((source) => (
                <tr key={source.name} className="border-t">
                  <td className="px-4 py-3 font-medium">{source.name}</td>
                  <td className="px-4 py-3">{source.type}</td>
                  <td className="px-4 py-3">{source.status}</td>
                  <td className="px-4 py-3">{source.frequency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
