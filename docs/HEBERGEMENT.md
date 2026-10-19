# Héberger SOLVEX AI sur votre serveur

SOLVEX AI est entièrement en **JavaScript**. Le serveur tourne sur Node.js, sans dépendance à installer, et l'interface est en JavaScript côté navigateur. Ce kit l'installe sur votre propre serveur, avec une adresse en **HTTPS**, et le garde en ligne jour et nuit.

## Ce qu'il faut

- Un serveur Linux allumé en permanence, avec une IP publique, par exemple un VPS Ubuntu ou Debian (OVH, Hetzner, Scaleway, IONOS…) ; 1 Go de RAM suffit.
- Les ports **80** et **443** ouverts vers ce serveur.
- Facultatif : un nom de domaine. Sans domaine, l'adresse sera `https://<votre-ip-avec-des-tirets>.sslip.io`, un service gratuit qui pointe vers votre IP.

Un ordinateur personnel convient aussi, mais il doit rester allumé, et votre box doit rediriger les ports 80 et 443 vers lui.

## Installation (5 minutes)

```bash
git clone https://github.com/arthurbayzelon24-commits/jeux.git solvex
cd solvex
git checkout claude/practical-cori-3k1wo6
sudo ./deploy/install.sh                 # ou : sudo ./deploy/install.sh solvex.mondomaine.fr
```

Le script :
1. installe Docker ;
2. crée `.env` avec un secret de session ;
3. choisit l'adresse ;
4. ouvre le pare-feu ;
5. construit et démarre SOLVEX AI et Caddy, qui obtient et renouvelle seul le certificat HTTPS ;
6. installe la surveillance.

Il affiche ensuite **l'adresse du site**.

Avec votre propre domaine, créez d'abord chez votre registraire un enregistrement DNS **A** `solvex.mondomaine.fr` → IP du serveur.

Ajoutez ensuite vos clés dans `.env` (`OPENAI_API_KEY`, `AI_MODEL`, `GEMINI_API_KEY`…), puis :

```bash
docker compose up -d
```

## Rester en ligne

| Protection | Effet |
| --- | --- |
| `restart: always` | Relance immédiate après un plantage, et au redémarrage du serveur |
| Contrôle de santé Docker (`/api/health`, toutes les 30 s) | Caddy n'envoie le trafic qu'à une application qui répond |
| `deploy/watchdog.sh` (cron, toutes les 5 min) | Relance tout si l'adresse publique ne répond plus (`/var/log/solvex-watchdog.log`) |
| Données dans un volume Docker (`solvex-data`) | Les créations survivent aux mises à jour et aux redémarrages |

Aucun hébergement ne garantit 100 % de disponibilité. Une panne du fournisseur, une coupure réseau ou une maintenance peuvent couper le site quelques minutes. Pour être prévenu, ajoutez un moniteur gratuit (UptimeRobot, Better Stack…) sur `https://<votre-adresse>/api/health`.

## Commandes utiles

```bash
docker compose ps                    # état
docker compose logs -f solvex        # journaux
git pull && docker compose up -d --build   # mise à jour
docker compose down                  # arrêt
```

## Sécurité

- Les clés API restent dans `.env` sur le serveur. Elles ne sont jamais dans l'image Docker (fichier exclu) ni dans le navigateur.
- L'application tourne sous un utilisateur non privilégié et n'est joignable qu'à travers Caddy, en HTTPS.
- **Sans `SOLVEX_ACCESS_CODE`, tout le monde peut utiliser le site, donc vos clés payantes.** Les générations sont limitées par minute et par IP, mais ajoutez un code d'accès si le site ne doit pas être public.
