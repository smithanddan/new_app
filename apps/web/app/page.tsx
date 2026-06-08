import { sampleResults } from '@labmind/shared';

export default function HomePage() {
  return (
    <main className="main">
      <section className="card" style={{ marginBottom: 16 }}>
        <span className="badge">MVP skeleton</span>
        <h1>LabMind — понятный разбор анализов</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 760 }}>
          Загрузите PDF/фото/Excel с результатами анализов, сервис извлечёт показатели, приведёт единицы и референсы к единому виду и подготовит аккуратный AI-отчёт без постановки диагноза.
        </p>
        <button className="button">Загрузить анализ</button>
      </section>

      <section className="grid" style={{ marginBottom: 16 }}>
        <div className="card"><h3>1. Импорт</h3><p>PDF, JPG, XLSX, HTML, Gmail/IMAP позже.</p></div>
        <div className="card"><h3>2. Нормализация</h3><p>Показатели, единицы, референсы, флаги.</p></div>
        <div className="card"><h3>3. Отчёт</h3><p>Ключевые отклонения, динамика, что проверить дальше.</p></div>
      </section>

      <section className="card">
        <h2>Пример таблицы результатов</h2>
        <table className="table">
          <thead>
            <tr><th>Показатель</th><th>Значение</th><th>Ед.</th><th>Референс</th><th>Флаг</th></tr>
          </thead>
          <tbody>
            {sampleResults.map((item) => (
              <tr key={item.code}>
                <td>{item.name}</td>
                <td>{item.value}</td>
                <td>{item.unit}</td>
                <td>{item.refLow}–{item.refHigh}</td>
                <td className={item.flag === 'normal' ? 'flag-normal' : 'flag-high'}>{item.flag}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
