#!/usr/bin/env bash
# Регрессионные проверки находок аудита 2026-11-14. Бьёт ТОЛЬКО по локальному серверу с пустой БД.
# Использование: ADMIN_PASSWORD=... BASE=http://127.0.0.1:3000 ./scripts/security-regression.sh
BASE="${BASE:-http://127.0.0.1:3000}"
ADMIN="${ADMIN_PASSWORD:?задайте ADMIN_PASSWORD сервера}"
J='Content-Type: application/json'
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fails=0
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
jget() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const o=JSON.parse(s);console.log(process.argv[1].split(".").reduce((a,k)=>a==null?a:a[k],o)??"")}catch(e){console.log("")}})' "$1"; }
reg() { curl -s -X POST $BASE/api/auth/login-register -H "$J" -d "{\"username\":\"$1\",\"password\":\"$2\",\"acceptTerms\":true}"; }
expect() { # name got want
  if [ "$2" = "$3" ]; then echo "ok   $1 ($2)"; else echo "FAIL $1: получили '$2', ожидали '$3'"; fails=$((fails+1)); fi
}

expect "C2 admin_secret не работает" "$(code -H 'x-admin-password: admin_secret' $BASE/api/admin/verify)" 401
expect "C2 верный пароль работает" "$(code -H "x-admin-password: $ADMIN" $BASE/api/admin/verify)" 200

TOK=$(reg victim1 victimpass1 | jget token)
[ -n "$TOK" ] && echo "ok   регистрация" || { echo "FAIL регистрация"; fails=$((fails+1)); }

# H2: без авторизации файл не пишется на диск
head -c 100000 /dev/urandom > "$TMP/junk.bin"
expect "H2 upload без токена" "$(code -F "file=@$TMP/junk.bin;filename=evil.html;type=image/png" $BASE/api/upload)" 401

# C1: HTML под видом video/mp4 отвергается (нет fallback на сырой файл)
printf '<script>alert(1)</script>' > "$TMP/poc.html"
expect "C1 HTML как video/mp4 → 415" "$(code -X POST $BASE/api/upload -H "Authorization: Bearer $TOK" -F "file=@$TMP/poc.html;filename=poc.html;type=video/mp4")" 415

# H4: verified / customBadge
expect "H4 сохранение профиля" "$(code -X POST $BASE/api/bio/victim1 -H "Authorization: Bearer $TOK" -H "$J" -d '{"username":"victim1","displayName":"x","verified":true,"customBadge":"OFFICIAL STAFF","blocks":[]}')" 400
curl -s -o /dev/null -X POST $BASE/api/bio/victim1 -H "Authorization: Bearer $TOK" -H "$J" -d '{"username":"victim1","displayName":"x","verified":true,"customBadge":"CREATOR","blocks":[]}'
expect "H4 verified не выставляется клиентом" "$(curl -s $BASE/api/bio/victim1 | jget verified)" false

# H5: alias и зарезервированные имена
TA=$(reg alice1 alicepass1 | jget token)
curl -s -o /dev/null -X POST $BASE/api/bio/alice1 -H "Authorization: Bearer $TA" -H "$J" -d '{"username":"alice1","displayName":"ALICE","aliasSlug":"coolname","blocks":[]}'
expect "H5 регистрация чужого alias" "$(code -X POST $BASE/api/auth/login-register -H "$J" -d '{"username":"coolname","password":"attackerpass1"}')" 400
for n in admin dashboard support; do
  expect "H5 имя '$n'" "$(code -X POST $BASE/api/auth/login-register -H "$J" -d "{\"username\":\"$n\",\"password\":\"somepass123\"}")" 400
done

# C3: бэкап → восстановление не оставляет рабочих токенов
curl -s -H "x-admin-password: $ADMIN" -o "$TMP/backup.zip" $BASE/api/admin/export-full
expect "C3 admin_password.txt нет в бэкапе" "$(unzip -Z1 "$TMP/backup.zip" | grep -c admin_password.txt)" 0
curl -s -X POST $BASE/api/admin/import-full -H "x-admin-password: $ADMIN" -F "file=@$TMP/backup.zip;type=application/zip" >/dev/null
expect "C3 старый токен после restore" "$(code -H "Authorization: Bearer $TOK" $BASE/api/auth/verify)" 401
expect "C3 токен [REDACTED]" "$(code -H 'Authorization: Bearer [REDACTED]' $BASE/api/auth/verify)" 401
expect "C3 пустой токен" "$(code -H 'Authorization: Bearer ' $BASE/api/auth/verify)" 401

# H1: ZIP с symlink отвергается
python3 - "$TMP" <<'PY'
import sys, zipfile
d=sys.argv[1]
z=zipfile.ZipFile(d+'/evil.zip','w')
i=zipfile.ZipInfo('x'); i.create_system=3; i.external_attr=(0o120777<<16)
z.writestr(i,'/tmp/pwned-by-zip')
z.writestr('dump.json','{}')
z.close()
PY
RES=$(curl -s -X POST $BASE/api/admin/import-full -H "x-admin-password: $ADMIN" -F "file=@$TMP/evil.zip;type=application/zip")
echo "$RES" | grep -qi "symlink\|unsafe\|error" && echo "ok   H1 symlink-ZIP отвергнут" || { echo "FAIL H1: $RES"; fails=$((fails+1)); }
[ ! -e /tmp/pwned-by-zip ] && echo "ok   H1 файл вне каталога не создан" || { echo "FAIL H1 файл создан"; fails=$((fails+1)); }

# L1: avif traversal
printf 'SECRET' > "$TMP/secret.avif"
expect "L1 avif traversal" "$(curl -s --path-as-is -H 'Accept: image/avif' "$BASE/uploads/a/..%2F..%2Fsecret.webp" | grep -c SECRET)" 0

# H3: spraying с одного IP
c429=0
for i in $(seq -w 1 40); do reg "spray$i" sprayPass1 >/dev/null; done
for i in $(seq -w 1 40); do r=$(code -X POST $BASE/api/auth/login-register -H "$J" -d "{\"username\":\"spray$i\",\"password\":\"Password123\"}"); [ "$r" = 429 ] && c429=$((c429+1)); done
[ "$c429" -gt 0 ] && echo "ok   H3 spraying ограничен ($c429×429)" || { echo "FAIL H3: 0×429"; fails=$((fails+1)); }

# M1: visit с огромным host
big=$(head -c 20000 /dev/zero | tr '\0' 'A')
expect "M1 visit с host 20000 символов" "$(code -X POST $BASE/api/bio/victim1/visit -H "$J" -d "{\"host\":\"$big\"}")" 200

# C2: перебор админ-пароля на import-full
c401=0; c429=0
for i in $(seq 1 40); do r=$(code -H "x-admin-password: wrong$i" $BASE/api/admin/import-full/incoming); [ "$r" = 401 ] && c401=$((c401+1)); [ "$r" = 429 ] && c429=$((c429+1)); done
[ "$c429" -gt 0 ] && echo "ok   C2 перебор import-full ограничен (401=$c401, 429=$c429)" || { echo "FAIL C2: 0×429"; fails=$((fails+1)); }

echo; [ "$fails" = 0 ] && echo "ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ" || echo "ПРОВАЛЕНО: $fails"
exit "$fails"
