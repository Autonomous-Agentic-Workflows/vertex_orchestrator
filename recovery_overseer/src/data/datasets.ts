import { SparkDataset } from '../types/spark';

export const INITIAL_DATASETS: SparkDataset[] = [
  {
    id: 'ecommerce_sales',
    name: 'ecommerce_sales',
    description: 'Global e-commerce order transactions with line-item details and payment metrics.',
    rowCount: 1250000,
    sizeMb: 184.5,
    partitionCount: 16,
    storageLevel: 'MEMORY_AND_DISK',
    schema: [
      { name: 'order_id', type: 'StringType', nullable: false },
      { name: 'timestamp', type: 'TimestampType', nullable: false },
      { name: 'customer_id', type: 'StringType', nullable: false },
      { name: 'region', type: 'StringType', nullable: false },
      { name: 'category', type: 'StringType', nullable: false },
      { name: 'product_name', type: 'StringType', nullable: false },
      { name: 'price', type: 'DoubleType', nullable: false },
      { name: 'quantity', type: 'IntegerType', nullable: false },
      { name: 'payment_method', type: 'StringType', nullable: false },
      { name: 'is_discounted', type: 'BooleanType', nullable: false }
    ],
    sampleData: [
      { order_id: 'ORD-9021', timestamp: '2026-07-28 08:14:22', customer_id: 'CUST-10492', region: 'North America', category: 'Electronics', product_name: 'Wireless Noise-Canceling Headphones', price: 249.99, quantity: 1, payment_method: 'Credit Card', is_discounted: true },
      { order_id: 'ORD-9022', timestamp: '2026-07-28 08:15:05', customer_id: 'CUST-88310', region: 'Europe', category: 'Apparel', product_name: 'Organic Cotton Hoodie', price: 68.00, quantity: 2, payment_method: 'PayPal', is_discounted: false },
      { order_id: 'ORD-9023', timestamp: '2026-07-28 08:16:40', customer_id: 'CUST-33104', region: 'Asia Pacific', category: 'Home Tech', product_name: 'Smart Robot Vacuum X1', price: 399.50, quantity: 1, payment_method: 'Apple Pay', is_discounted: true },
      { order_id: 'ORD-9024', timestamp: '2026-07-28 08:18:12', customer_id: 'CUST-10492', region: 'North America', category: 'Electronics', product_name: 'USB-C Fast Charger 65W', price: 29.99, quantity: 3, payment_method: 'Credit Card', is_discounted: false },
      { order_id: 'ORD-9025', timestamp: '2026-07-28 08:20:00', customer_id: 'CUST-44192', region: 'Latin America', category: 'Sports', product_name: 'Trail Running Shoes', price: 120.00, quantity: 1, payment_method: 'Debit Card', is_discounted: false },
      { order_id: 'ORD-9026', timestamp: '2026-07-28 08:22:15', customer_id: 'CUST-55102', region: 'Europe', category: 'Electronics', product_name: '4K UltraHD Monitor 27"', price: 349.00, quantity: 1, payment_method: 'Credit Card', is_discounted: true },
      { order_id: 'ORD-9027', timestamp: '2026-07-28 08:25:30', customer_id: 'CUST-88310', region: 'Europe', category: 'Home Tech', product_name: 'Smart Ambient Desk Lamp', price: 45.00, quantity: 2, payment_method: 'PayPal', is_discounted: false },
      { order_id: 'ORD-9028', timestamp: '2026-07-28 08:29:44', customer_id: 'CUST-99201', region: 'Asia Pacific', category: 'Apparel', product_name: 'Merino Wool Socks (3-Pack)', price: 22.50, quantity: 4, payment_method: 'Crypto', is_discounted: true }
    ]
  },
  {
    id: 'server_access_logs',
    name: 'server_access_logs',
    description: 'Web infrastructure traffic logs containing HTTP requests, latency metrics, and status codes.',
    rowCount: 8400000,
    sizeMb: 920.0,
    partitionCount: 32,
    storageLevel: 'MEMORY_ONLY',
    schema: [
      { name: 'client_ip', type: 'StringType', nullable: false },
      { name: 'timestamp', type: 'TimestampType', nullable: false },
      { name: 'http_method', type: 'StringType', nullable: false },
      { name: 'uri_path', type: 'StringType', nullable: false },
      { name: 'status_code', type: 'IntegerType', nullable: false },
      { name: 'bytes_sent', type: 'LongType', nullable: false },
      { name: 'latency_ms', type: 'DoubleType', nullable: false },
      { name: 'user_agent', type: 'StringType', nullable: true }
    ],
    sampleData: [
      { client_ip: '192.168.1.104', timestamp: '2026-07-28 07:00:01', http_method: 'GET', uri_path: '/api/v1/products', status_code: 200, bytes_sent: 4520, latency_ms: 18.4, user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)' },
      { client_ip: '10.0.4.52', timestamp: '2026-07-28 07:00:03', http_method: 'POST', uri_path: '/api/v1/checkout', status_code: 201, bytes_sent: 1200, latency_ms: 142.8, user_agent: 'MobileApp/2.4 Android' },
      { client_ip: '172.16.0.8', timestamp: '2026-07-28 07:00:05', http_method: 'GET', uri_path: '/static/css/app.css', status_code: 304, bytes_sent: 0, latency_ms: 2.1, user_agent: 'Mozilla/5.0 (Windows NT 10.0)' },
      { client_ip: '192.168.1.104', timestamp: '2026-07-28 07:00:12', http_method: 'GET', uri_path: '/api/v1/user/profile', status_code: 200, bytes_sent: 890, latency_ms: 24.0, user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)' },
      { client_ip: '198.51.100.44', timestamp: '2026-07-28 07:00:15', http_method: 'GET', uri_path: '/admin/db-export', status_code: 403, bytes_sent: 340, latency_ms: 5.6, user_agent: 'Python-urllib/3.9' }
    ]
  },
  {
    id: 'iot_sensors',
    name: 'iot_sensors',
    description: 'High-frequency telemetry stream from distributed industrial IoT sensors.',
    rowCount: 5000000,
    sizeMb: 412.0,
    partitionCount: 20,
    storageLevel: 'DISK_ONLY',
    schema: [
      { name: 'sensor_id', type: 'StringType', nullable: false },
      { name: 'facility', type: 'StringType', nullable: false },
      { name: 'timestamp', type: 'TimestampType', nullable: false },
      { name: 'temperature_c', type: 'DoubleType', nullable: false },
      { name: 'humidity_pct', type: 'DoubleType', nullable: false },
      { name: 'vibration_hz', type: 'DoubleType', nullable: false },
      { name: 'pressure_psi', type: 'DoubleType', nullable: false },
      { name: 'anomaly_flag', type: 'BooleanType', nullable: false }
    ],
    sampleData: [
      { sensor_id: 'SENS-TX-01', facility: 'Austin Fab 4', timestamp: '2026-07-28 07:00:00', temperature_c: 68.4, humidity_pct: 42.1, vibration_hz: 120.4, pressure_psi: 14.7, anomaly_flag: false },
      { sensor_id: 'SENS-TX-02', facility: 'Austin Fab 4', timestamp: '2026-07-28 07:00:00', temperature_c: 89.2, humidity_pct: 31.0, vibration_hz: 480.9, pressure_psi: 22.1, anomaly_flag: true },
      { sensor_id: 'SENS-CA-08', facility: 'Fremont Solar', timestamp: '2026-07-28 07:00:01', temperature_c: 44.1, humidity_pct: 55.4, vibration_hz: 12.0, pressure_psi: 14.5, anomaly_flag: false },
      { sensor_id: 'SENS-DE-12', facility: 'Berlin Plant 2', timestamp: '2026-07-28 07:00:02', temperature_c: 72.0, humidity_pct: 39.8, vibration_hz: 140.2, pressure_psi: 15.0, anomaly_flag: false }
    ]
  },
  {
    id: 'financial_trades',
    name: 'financial_trades',
    description: 'Real-time financial exchange tick data for equities and ETFs.',
    rowCount: 3200000,
    sizeMb: 310.0,
    partitionCount: 12,
    storageLevel: 'MEMORY_AND_DISK',
    schema: [
      { name: 'trade_id', type: 'StringType', nullable: false },
      { name: 'symbol', type: 'StringType', nullable: false },
      { name: 'timestamp', type: 'TimestampType', nullable: false },
      { name: 'price', type: 'DoubleType', nullable: false },
      { name: 'volume', type: 'IntegerType', nullable: false },
      { name: 'exchange', type: 'StringType', nullable: false },
      { name: 'buyer_firm', type: 'StringType', nullable: false },
      { name: 'seller_firm', type: 'StringType', nullable: false }
    ],
    sampleData: [
      { trade_id: 'TRD-88001', symbol: 'NVDA', timestamp: '2026-07-28 09:30:01', price: 138.50, volume: 500, exchange: 'NASDAQ', buyer_firm: 'Goldman Sachs', seller_firm: 'Morgan Stanley' },
      { trade_id: 'TRD-88002', symbol: 'GOOGL', timestamp: '2026-07-28 09:30:02', price: 182.20, volume: 1200, exchange: 'NASDAQ', buyer_firm: 'BlackRock', seller_firm: 'Vanguard' },
      { trade_id: 'TRD-88003', symbol: 'AAPL', timestamp: '2026-07-28 09:30:03', price: 224.10, volume: 800, exchange: 'NASDAQ', buyer_firm: 'Citadel', seller_firm: 'JPMorgan' },
      { trade_id: 'TRD-88004', symbol: 'NVDA', timestamp: '2026-07-28 09:30:05', price: 138.85, volume: 2500, exchange: 'NASDAQ', buyer_firm: 'Vanguard', seller_firm: 'Citadel' }
    ]
  }
];
