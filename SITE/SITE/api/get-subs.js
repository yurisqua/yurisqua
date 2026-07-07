export default async function handler(req, res) {
  // On récupère tes identifiants secrets configurés sur Vercel (Étape 3)
  const accountId = process.env.STREAMELEMENTS_ACCOUNT_ID;
  const jwtToken = process.env.STREAMELEMENTS_JWT;

  if (!accountId || !jwtToken) {
    return res.status(500).json({ error: "Variables de configuration manquantes." });
  }

  try {
    // 1. Récupération du nombre total de subs
    const subsResponse = await fetch(`https://api.streamelements.com/v2/channels/${accountId}/subscriptions/count`, {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    const subsData = await subsResponse.json();

    // 2. Récupération des derniers subs pour le bandeau défilant
    const historyResponse = await fetch(`https://api.streamelements.com/v2/channels/${accountId}/history?limit=10&type=subscriber`, {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    const historyData = await historyResponse.json();

    // On formate les données proprement pour ton fichier index.html
    const recentSubs = Array.isArray(historyData) ? historyData.map(item => ({
      name: item.data?.username || "Anonyme",
      months: item.data?.amount || 1,
      gifted: !!item.data?.gifted,
      sender: item.data?.sender || null
    })) : [];

    return res.status(200).json({
      subs: subsData.count || 0,
      recent: recentSubs
    });
  } catch (error) {
    return res.status(500).json({ error: "Impossible de joindre StreamElements" });
  }
}