const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envFile = path.join(__dirname, '.env.local');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  });
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function exportTodayFlights() {
  try {
    // First, find available dates
    console.log('Checking available dates...');
    const datesSQL = `
      SELECT DISTINCT flight_date 
      FROM flights_current_snapshot 
      ORDER BY flight_date DESC 
      LIMIT 10
    `;
    const datesResult = await pool.query(datesSQL);
    console.log('Available dates:', datesResult.rows.map(r => r.flight_date));
    
    let date = '2026-04-15';
    if (datesResult.rows.length === 0) {
      console.log('No flights found in database');
      return;
    }
    
    // Use first available date
    date = datesResult.rows[0].flight_date;
    console.log(`Fetching flights for ${date}...`);
    
    const sql = `
      SELECT
        s.flight_key,
        s.flight_number,
        s.source_airport,
        s.direction,
        s.route_airport_std,
        s.status_group,
        s.delay_minutes,
        s.label_delay,
        p.predict_delay_minutes,
        s.airline_code
      FROM flights_current_snapshot s
      LEFT JOIN flights_predictions p ON s.flight_key = p.flight_key
      WHERE s.flight_date = $1
      ORDER BY s.source_airport, s.direction
      LIMIT 50
    `;
    const result = await pool.query(sql, [date]);
    
    if (result.rowCount === 0) {
      console.log('No flights found for this date');
      return;
    }

    const filename = `flights-${date}.json`;
    const data = {
      date: date,
      total_records: result.rowCount,
      sample: result.rows,
    };
    
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`\n✓ Exported to ${filename}`);
    console.log(`\nFirst 10 records:\n`);
    console.log(JSON.stringify(result.rows.slice(0, 10), null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err);
  } finally {
    await pool.end();
  }
}

exportTodayFlights();
