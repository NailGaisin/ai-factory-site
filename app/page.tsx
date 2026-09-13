"use client";

import { FormEvent, useState } from "react";

const initialForm = {
  name: "",
  company: "",
  contact: "",
  niche: "",
};

function getTrackingPayload() {
  const params = new URLSearchParams(window.location.search);
  const clean = (value: string | null) => value?.trim().slice(0, 120) || null;
  const utmSource = clean(params.get("utm_source"));

  return {
    leadSource: utmSource ? "utm" : document.referrer ? "referral" : "direct",
    utmSource,
    utmMedium: clean(params.get("utm_medium")),
    utmCampaign: clean(params.get("utm_campaign")),
  };
}

export default function Home() {
  const [form, setForm] = useState(initialForm);
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setMessage("");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...getTrackingPayload() }),
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        setState("success");
        setMessage("Заявка принята. Мы свяжемся с вами в ближайшее время.");
        setForm(initialForm);
      } else {
        setState("error");
        setMessage(result.error ?? "Не удалось отправить заявку.");
      }
    } catch {
      setState("error");
      setMessage("Ошибка соединения. Попробуйте ещё раз.");
    }
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; background: #050816; }

        .page {
          min-height: 100vh;
          color: #f8fafc;
          background:
            radial-gradient(circle at 75% 8%, rgba(37,99,235,.28), transparent 28%),
            radial-gradient(circle at 15% 22%, rgba(124,58,237,.18), transparent 25%),
            #050816;
          font-family: Arial, sans-serif;
          overflow: hidden;
        }

        .container {
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
        }

        .nav {
          height: 76px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,.07);
        }

        .logo {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: .12em;
        }

        .logo span { color: #60a5fa; }

        .nav-link {
          color: #cbd5e1;
          text-decoration: none;
          font-size: 14px;
        }

        .nav-button {
          color: white;
          text-decoration: none;
          padding: 11px 18px;
          border-radius: 10px;
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.1);
        }

        .hero {
          min-height: 690px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 70px;
          align-items: center;
          padding: 70px 0 80px;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          color: #bfdbfe;
          background: rgba(37,99,235,.1);
          border: 1px solid rgba(96,165,250,.22);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .08em;
        }

        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #60a5fa;
          box-shadow: 0 0 14px #60a5fa;
        }

        h1 {
          margin: 22px 0;
          font-size: clamp(48px, 6vw, 76px);
          line-height: .98;
          letter-spacing: -.055em;
        }

        .gradient {
          background: linear-gradient(100deg, #fff 15%, #93c5fd 52%, #a78bfa 90%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .hero-text {
          max-width: 590px;
          color: #94a3b8;
          font-size: 19px;
          line-height: 1.65;
        }

        .actions {
          display: flex;
          gap: 14px;
          margin-top: 30px;
          flex-wrap: wrap;
        }

        .primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 15px 24px;
          border-radius: 12px;
          color: white;
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          text-decoration: none;
          font-weight: 700;
          box-shadow: 0 15px 40px rgba(37,99,235,.25);
        }

        .secondary {
          display: inline-flex;
          align-items: center;
          padding: 15px 22px;
          border-radius: 12px;
          color: #cbd5e1;
          border: 1px solid rgba(255,255,255,.1);
          background: rgba(255,255,255,.04);
          text-decoration: none;
        }

        .dashboard {
          position: relative;
          padding: 14px;
          border-radius: 24px;
          background: linear-gradient(145deg, rgba(255,255,255,.12), rgba(255,255,255,.025));
          border: 1px solid rgba(255,255,255,.1);
          box-shadow: 0 30px 100px rgba(0,0,0,.5);
          backdrop-filter: blur(20px);
        }

        .dashboard-caption {
          margin: 12px 4px 0;
          color: #64748b;
          font-size: 12px;
          text-align: center;
        }

        .window {
          border-radius: 17px;
          overflow: hidden;
          background: #0a1020;
          border: 1px solid rgba(255,255,255,.08);
        }

        .window-top {
          height: 48px;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 0 17px;
          border-bottom: 1px solid rgba(255,255,255,.07);
        }

        .window-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #334155;
        }

        .dashboard-body { padding: 22px; }

        .dashboard-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .dashboard-title strong { font-size: 17px; }
        .online { color: #4ade80; font-size: 11px; }

        .metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .metric {
          padding: 15px;
          border-radius: 13px;
          background: rgba(255,255,255,.045);
          border: 1px solid rgba(255,255,255,.06);
        }

        .metric small { color: #64748b; }
        .metric strong { display: block; margin-top: 7px; font-size: 24px; }

        .leads {
          margin-top: 16px;
          border-radius: 14px;
          background: rgba(255,255,255,.035);
          border: 1px solid rgba(255,255,255,.06);
          overflow: hidden;
        }

        .lead {
          display: grid;
          grid-template-columns: 1fr 70px 62px;
          align-items: center;
          gap: 10px;
          padding: 15px;
          border-bottom: 1px solid rgba(255,255,255,.05);
        }

        .lead:last-child { border-bottom: 0; }

        .lead-name { font-weight: 700; font-size: 13px; }
        .lead-company { color: #64748b; font-size: 11px; margin-top: 4px; }

        .hot, .warm, .cold {
          text-align: center;
          padding: 5px 6px;
          border-radius: 7px;
          font-size: 9px;
          font-weight: 800;
        }

        .hot { color: #fca5a5; background: rgba(239,68,68,.13); }
        .warm { color: #fcd34d; background: rgba(245,158,11,.13); }
        .cold { color: #94a3b8; background: rgba(100,116,139,.13); }

        .score { text-align: right; font-weight: 800; }

        .features {
          padding: 35px 0 42px;
        }

        .section-head {
          max-width: 680px;
          margin-bottom: 38px;
        }

        .section-head h2 {
          font-size: 42px;
          letter-spacing: -.04em;
          margin: 12px 0;
        }

        .section-head p {
          color: #94a3b8;
          line-height: 1.7;
          font-size: 17px;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .card {
          padding: 27px;
          min-height: 210px;
          border-radius: 18px;
          background: rgba(255,255,255,.035);
          border: 1px solid rgba(255,255,255,.08);
        }

        .icon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: rgba(96,165,250,.1);
          color: #93c5fd;
          font-weight: 800;
        }

        .card h3 { margin: 22px 0 10px; font-size: 19px; }
        .card p { color: #94a3b8; line-height: 1.65; margin: 0; }

        .offer {
          padding: 58px 0 82px;
        }

        .offer-panel {
          padding: 42px;
          border-radius: 22px;
          background: rgba(255,255,255,.035);
          border: 1px solid rgba(255,255,255,.08);
        }

        .offer-panel h2 {
          max-width: 670px;
          margin: 14px 0 12px;
          font-size: 42px;
          letter-spacing: -.04em;
        }

        .offer-panel > p {
          max-width: 680px;
          margin: 0;
          color: #94a3b8;
          font-size: 17px;
          line-height: 1.7;
        }

        .offer-list {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin: 28px 0 30px;
        }

        .offer-item {
          padding: 18px;
          border-radius: 14px;
          color: #cbd5e1;
          background: rgba(2,6,23,.35);
          border: 1px solid rgba(255,255,255,.07);
          line-height: 1.45;
        }

        .offer-item strong {
          display: block;
          margin-bottom: 7px;
          color: #fff;
          font-size: 15px;
        }

        .cta {
          margin: 20px 0 90px;
          padding: 55px;
          border-radius: 25px;
          background:
            radial-gradient(circle at 80% 20%, rgba(124,58,237,.28), transparent 35%),
            linear-gradient(135deg, rgba(37,99,235,.16), rgba(255,255,255,.035));
          border: 1px solid rgba(255,255,255,.1);
        }

        .cta-grid {
          display: grid;
          grid-template-columns: .8fr 1.2fr;
          gap: 50px;
          align-items: center;
        }

        .cta h2 {
          font-size: 42px;
          line-height: 1.05;
          letter-spacing: -.04em;
          margin: 12px 0;
        }

        .cta p { color: #94a3b8; line-height: 1.6; }

        .diagnostic-list {
          display: grid;
          gap: 10px;
          margin: 26px 0 0;
          padding: 0;
          list-style: none;
        }

        .diagnostic-list li {
          position: relative;
          padding-left: 26px;
          color: #cbd5e1;
          font-size: 14px;
          line-height: 1.45;
        }

        .diagnostic-list li::before {
          content: "✓";
          position: absolute;
          left: 0;
          top: -1px;
          color: #93c5fd;
          font-weight: 800;
        }

        form {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        input {
          width: 100%;
          padding: 15px 16px;
          border-radius: 11px;
          border: 1px solid rgba(255,255,255,.1);
          outline: none;
          background: rgba(0,0,0,.22);
          color: white;
          font-size: 14px;
        }

        input:focus { border-color: rgba(96,165,250,.65); }

        .form-submit {
          grid-column: 1 / -1;
          border: 0;
          padding: 15px;
          border-radius: 11px;
          color: white;
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          font-weight: 800;
          cursor: pointer;
        }

        .message {
          grid-column: 1 / -1;
          padding: 12px;
          border-radius: 10px;
          background: rgba(255,255,255,.05);
          color: #cbd5e1;
          font-size: 13px;
        }

        .footer {
          padding: 25px 0 45px;
          color: #475569;
          font-size: 12px;
          border-top: 1px solid rgba(255,255,255,.06);
        }

        @media (max-width: 850px) {
          .hero, .cta-grid { grid-template-columns: 1fr; }
          .hero { padding-top: 50px; gap: 40px; }
          .cards, .offer-list { grid-template-columns: 1fr; }
          .cta { padding: 30px; }
        }

        @media (max-width: 560px) {
          .container { width: min(100% - 24px, 1180px); }
          .nav-link { display: none; }
          h1 { font-size: 48px; }
          .hero-text { font-size: 17px; }
          .metrics { grid-template-columns: 1fr; }
          .cta h2, .section-head h2, .offer-panel h2 { font-size: 34px; }
          .offer-panel { padding: 28px; }
          form { grid-template-columns: 1fr; }
        }
      `}</style>

      <main className="page">
        <div className="container">
          <nav className="nav">
            <div className="logo">AI <span>FACTORY</span></div>
            <a className="nav-link" href="#how">Что внедряем</a>
            <a className="nav-button" href="#demo">Бесплатная диагностика</a>
          </nav>

          <section className="hero">
            <div>
              <div className="eyebrow">
                <span className="dot" />
                AI-СИСТЕМА ПРОДАЖ · ДЛЯ B2B-УСЛУГ
              </div>

              <h1>
                Не теряйте заявки.
                <br />
                <span className="gradient">Превращайте обращения в сделки.</span>
              </h1>

              <p className="hero-text">
                AI Factory внедряет систему обработки входящих обращений: она
                собирает лиды, определяет приоритет, подсказывает менеджеру
                следующий шаг и помогает не забыть о повторном контакте.
              </p>

              <div className="actions">
                <a className="primary" href="#demo">Бесплатная диагностика →</a>
                <a className="secondary" href="#how">Что именно внедряем</a>
              </div>
            </div>

            <div className="dashboard">
              <div className="window">
                <div className="window-top">
                  <span className="window-dot" />
                  <span className="window-dot" />
                  <span className="window-dot" />
                </div>

                <div className="dashboard-body">
                  <div className="dashboard-title">
                    <strong>Панель заявок</strong>
                    <span className="online">● В РАБОТЕ</span>
                  </div>

                  <div className="metrics">
                    <div className="metric">
                      <small>Новая</small>
                      <strong>01</strong>
                    </div>
                    <div className="metric">
                      <small>В работе</small>
                      <strong>02</strong>
                    </div>
                    <div className="metric">
                      <small>Следующий шаг</small>
                      <strong>Сегодня</strong>
                    </div>
                  </div>

                  <div className="leads">
                    <div className="lead">
                      <div>
                        <div className="lead-name">Заявка на консультацию</div>
                        <div className="lead-company">Строительные услуги</div>
                      </div>
                      <div className="hot">HOT</div>
                      <div className="score">94</div>
                    </div>

                    <div className="lead">
                      <div>
                        <div className="lead-name">Запрос расчёта</div>
                        <div className="lead-company">Юридические услуги</div>
                      </div>
                      <div className="warm">WARM</div>
                      <div className="score">71</div>
                    </div>

                    <div className="lead">
                      <div>
                        <div className="lead-name">Повторный контакт</div>
                        <div className="lead-company">Агентство услуг</div>
                      </div>
                      <div className="cold">COLD</div>
                      <div className="score">38</div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="dashboard-caption">Пример рабочего интерфейса</p>
            </div>
          </section>

          <section className="features" id="how">
            <div className="section-head">
              <div className="eyebrow">НЕ CRM РАДИ CRM</div>
              <h2>Система возвращает внимание менеджера к тем, кто готов купить.</h2>
              <p>
                Для компаний услуг, у которых уже есть входящие обращения. Вместо
                таблиц и хаоса — понятный процесс: кто написал, насколько лид
                горячий и что сделать, чтобы разговор не оборвался.
              </p>
            </div>

            <div className="cards">
              <div className="card">
                <div className="icon">01</div>
                <h3>Собирает и квалифицирует обращения</h3>
                <p>
                  Каждая заявка попадает в одну очередь, получает краткое резюме
                  и приоритет для обработки.
                </p>
              </div>

              <div className="card">
                <div className="icon">02</div>
                <h3>Держит менеджера в фокусе</h3>
                <p>
                  Статусы, сумма сделки и история контакта помогают видеть реальную
                  воронку, а не просто список телефонов.
                </p>
              </div>

              <div className="card">
                <div className="icon">03</div>
                <h3>Не даёт забыть следующий шаг</h3>
                <p>
                  AI подсказывает первый ответ, а система напоминает, когда пора
                  вернуться к клиенту и продолжить диалог.
                </p>
              </div>
            </div>
          </section>

          <section className="offer" id="offer">
            <div className="offer-panel">
              <div className="eyebrow">ПРОДУКТОВЫЙ ФОРМАТ</div>
              <h2>AI-отдел продаж за 14 дней.</h2>
              <p>
                Не продаём набор разрозненных функций. За короткое внедрение
                собираем ваш путь заявки — от первого обращения до сделки — и
                оставляем команде работающий процесс контроля.
              </p>

              <div className="offer-list">
                <div className="offer-item">
                  <strong>1. Карта потерь заявок</strong>
                  Находим, где обращения теряются, зависают или получают ответ слишком поздно.
                </div>
                <div className="offer-item">
                  <strong>2. CRM + AI + Telegram</strong>
                  Настраиваем единый поток: заявка, приоритет, карточка клиента и уведомления.
                </div>
                <div className="offer-item">
                  <strong>3. Скрипты и контроль</strong>
                  Фиксируем следующий шаг, правила follow-up и основу для регулярного улучшения продаж.
                </div>
              </div>

              <a className="primary" href="#demo">Бесплатная диагностика →</a>
            </div>
          </section>

          <section className="cta" id="demo">
            <div className="cta-grid">
              <div>
                <div className="eyebrow">БЕСПЛАТНАЯ ДИАГНОСТИКА · 20 МИНУТ</div>
                <h2>Сначала разберёмся, где заявки теряются в вашей воронке.</h2>
                <p>
                  Это короткий деловой созвон без обязательств. До разговора
                  изучим ваш путь заявки, а на созвоне покажем, что имеет смысл
                  исправить в первую очередь.
                </p>

                <ul className="diagnostic-list">
                  <li>Проверим, откуда приходят обращения и кто их берёт в работу.</li>
                  <li>Найдём один–три узких места: скорость ответа, статус или повторный контакт.</li>
                  <li>Скажем честно, подходит ли вам пилот AI Factory.</li>
                </ul>
              </div>

              <form onSubmit={submit}>
                <input
                  required
                  placeholder="Ваше имя"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />

                <input
                  required
                  placeholder="Компания"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />

                <input
                  required
                  placeholder="Телефон или Telegram"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                />

                <input
                  required
                  placeholder="Ниша / направление"
                  value={form.niche}
                  onChange={(e) => setForm({ ...form, niche: e.target.value })}
                />

                <button className="form-submit" type="submit" disabled={state === "sending"}>
                  {state === "sending" ? "Отправляем..." : "Записаться на диагностику →"}
                </button>

                {message && <div className="message">{message}</div>}
              </form>
            </div>
          </section>

          <footer className="footer">
            AI FACTORY — система обработки входящих заявок для компаний услуг.
          </footer>
        </div>
      </main>
    </>
  );
}
