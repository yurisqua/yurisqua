// Fonction serverless Vercel : compteur de subs + derniers subs/subgifts StreamElements
// Les identifiants viennent des variables d'environnement Vercel si configurées,
// sinon des valeurs de secours ci-dessous.
module.exports = async function handler(req, res) {
  // IMPORTANT : ne jamais coder un secret en dur ici. Configure ces deux valeurs
  // exclusivement dans les variables d'environnement Vercel (Project Settings > Environment Variables).
  const accountId = process.env.STREAMELEMENTS_ACCOUNT_ID;
  const jwtToken = process.env.STREAMELEMENTS_JWT;

  if (!accountId || !jwtToken) {
    return res.status(500).json({ error: "Configuration manquante : STREAMELEMENTS_ACCOUNT_ID / STREAMELEMENTS_JWT ne sont pas définis dans les variables d'environnement." });
  }

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
