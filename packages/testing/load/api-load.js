import http from 'k6/http';
import { check, sleep } from 'k6';

// 500 VUs for 1 minute
export const options = {
  vus: 500,
  duration: '1m',
};

export default function () {
  // Simulating fetching devices on Dashboard load
  const res = http.get('http://localhost:8080/api/devices', {
    headers: {
      // Simulate auth if needed, but for stress testing we might bypass or use a mock token
      'Authorization': 'Bearer test-token'
    }
  });

  check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);
}
