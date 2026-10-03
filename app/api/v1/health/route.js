export async function GET() {
  return Response.json({
    status: 'healthy',
    service: 'PondFish Unified Portal API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
}
