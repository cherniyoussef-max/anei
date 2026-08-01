import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

const base = __ENV.BASE_URL || "http://127.0.0.1:3000";

export default function smokeJourney() {
  for (const path of ["/fr", "/fr/formations", "/fr/webinaires", "/fr/bibliotheque"]) {
    const response = http.get(`${base}${path}`);
    check(response, { [`${path} returns 2xx/3xx`]: (r) => r.status >= 200 && r.status < 400 });
  }
  sleep(1);
}
