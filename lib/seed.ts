import { Client } from 'pg'; // PostgreSQL client for Supabase
import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';
import "dotenv/config";



// Parse date in YYYY-MM-DD format
function parseDate(dateString: string): string {
  const parts = dateString.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  console.warn(`Could not parse date: ${dateString}`);
  throw Error();
}

async function seed() {
  // Connect to Supabase PostgreSQL
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
  });

  try {
    await client.connect();
    console.log("Connected to Supabase");

    // Create the unicorns table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS unicorns (
        id SERIAL PRIMARY KEY,
        company VARCHAR(255) NOT NULL UNIQUE,
        valuation DECIMAL(10, 2) NOT NULL,
        date_joined DATE,
        country VARCHAR(255) NOT NULL,
        city VARCHAR(255) NOT NULL,
        industry VARCHAR(255) NOT NULL,
        select_investors TEXT NOT NULL
      );
    `);
    console.log(`Created "unicorns" table`);

    // Read and parse the CSV file
    const results: any[] = [];
    const csvFilePath = path.join(process.cwd(), 'unicorns.csv');

    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    // Insert data into the database
    for (const row of results) {
      const formattedDate = parseDate(row['Date Joined']);

      await client.query(
        `
          INSERT INTO unicorns (company, valuation, date_joined, country, city, industry, select_investors)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (company) DO NOTHING;
        `,
        [
          row.Company,
          parseFloat(row['Valuation ($B)'].replace('$', '').replace(',', '')),
          formattedDate,
          row.Country,
          row.City,
          row.Industry,
          row['Select Investors'],
        ]
      );
    }

    console.log(`Seeded ${results.length} unicorns`);
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await client.end();
    console.log("Disconnected from Supabase");
  }
}

seed().catch(console.error);
