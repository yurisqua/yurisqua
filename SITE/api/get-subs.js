// Fonction serverless Vercel : compteur de subs + derniers subs/subgifts StreamElements
// Les identifiants viennent des variables d'environnement Vercel si configurées,
// sinon des valeurs de secours ci-dessous.
module.exports = async function handler(req, res) {
  const accountId = process.env.STREAMELEMENTS_ACCOUNT_ID || "5cdbcb0c05ee530db7df2cb5";
  const jwtToken = process.env.STREAMELEMENTS_JWT || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJjaXRhZGVsIiwiZXhwIjoxNzk2NTEwNDg1LCJqdGkiOiJlYWEzMjEyYS1kMGIwLTQyNWQtYjA5Yy04Zjc5NDU4OTA2ZDYiLCJjaGFubmVsIjoiNWNkYmNiMGMwNWVlNTMwZGI3ZGYyY2I1Iiwicm9sZSI6Im93bmVyIiwiYXV0aFRva2VuIjoiOHktVGRKLVlkZXRvVV9FMTdIU2Y0YktYNUtZNk1PaDY1bXBRQ1ZQcFFzc2tRV3FVIiwidXNlciI6IjVjZGJjYjBjMDVlZTUzOGU1ZWRmMmNiNCIsInVzZXJfaWQiOiI0N2M0ZjhlMi1mNzZiLTQzYTYtYjVmOS1kMzNlYjllN2E5MzkiLCJ1c2VyX3JvbGUiOiJjcmVhdG9yIiwicHJvdmlkZXIiOiJ0d2l0Y2giLCJwcm92aWRlcl9pZCI6IjQzMTUzMDM4NSIsImNoYW5uZWxfaWQiOiJlNjkxMGIwZC05NjE1LTQ3NjYtYjczNy01NmIwNDBhMjYzYjgiLCJjcmVhdG9yX2lkIjoiN2NkODliYzgtZWY0NC00NjM1LWI1OTEtZjU4N2JkNTZjZGRhIn0.BAMVRMoaUuNg2wxsffAhONj_Mvl8XT1ZzxV3jZMPz7w";

  const headers = {
    "Accept": "application/json",
    "Authorization": `Bearer ${jwtToken}`
  };

  try {
    // Fenêtre de 90 jours pour l'historique des subs
    const before = new Date().toISOString();
    const after = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();

    // "sessions" : compteurs temps réel (subscriber-total = subs actifs)
    // "activities" : historique des derniers subs / subgifts
    // NB : ce sont les seuls endpoints valides, /v2/channels/{id}/stats
    // et /subscriptions/count renvoient 404.
    const [sessionRes, actRes] = await Promise.all([
      fetch(`https://api.streamelements.com/kappa/v2/sessions/${accountId}`, { headers }),
      fetch(`https://api.streamelements.com/kappa/v2/activities/${accountId}?after=${after}&before=${before}&limit=25&types=subscriber`, { headers })
    ]);

    if (!sessionRes.ok) {
      return res.status(sessionRes.status).json({ error: "Erreur de connexion a l'API StreamElements" });
    }

    const session = await sessionRes.json();
    const d = session.data || {};
    const subCount = (d["subscriber-total"] && d["subscriber-total"].count) || 0;

    // Liste des derniers subs / subgifts pour le bandeau défilant
    let recent = [];
    if (actRes.ok) {
      const acts = await actRes.json();
      if (Array.isArray(acts)) {
        recent = acts.map(a => {
          const ad = a.data || {};
          return {
            name: ad.displayName || ad.username || "Anonyme",
            months: ad.amount || 1,
            tier: ad.tier || "1000",
            gifted: !!ad.gifted,
            sender: ad.sender || null,
            date: a.createdAt
          };
        });
      }
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      subs: subCount,
      subsSession: (d["subscriber-session"] && d["subscriber-session"].count) || 0,
      subsMonth: (d["subscriber-month"] && d["subscriber-month"].count) || 0,
      latestSub: (d["subscriber-latest"] && d["subscriber-latest"].name) || null,
      recent: recent
    });
  } catch (error) {
    return res.status(500).json({ error: "Impossible de joindre StreamElements", details: error.message });
  }
};
