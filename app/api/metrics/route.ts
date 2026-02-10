import { NextRequest, NextResponse } from 'next/server';
import { esClient } from '@/lib/elastic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);
    
    // Calculate date range
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    // Aggregate metrics from ops-metrics index
    const response = await esClient.search({
      index: 'ops-metrics',
      query: {
        bool: {
          filter: [
            {
              range: {
                timestamp: {
                  gte: startDate.toISOString(),
                  lte: now.toISOString(),
                },
              },
            },
          ],
        },
      },
      aggs: {
        by_metric_name: {
          terms: {
            field: 'metric_name',
            size: 50,
          },
          aggs: {
            total_value: {
              sum: {
                field: 'value',
              },
            },
            avg_value: {
              avg: {
                field: 'value',
              },
            },
          },
        },
        by_category: {
          terms: {
            field: 'category',
            size: 20,
          },
          aggs: {
            total_value: {
              sum: {
                field: 'value',
              },
            },
          },
        },
      },
      size: 0,
    });
    
    // Transform aggregations into metrics object
    const metricsByName: Record<string, any> = {};
    const aggs = response.aggregations as any;
    
    if (aggs?.by_metric_name?.buckets) {
      aggs.by_metric_name.buckets.forEach((bucket: any) => {
        metricsByName[bucket.key] = {
          total: bucket.total_value.value,
          avg: bucket.avg_value.value,
          count: bucket.doc_count,
        };
      });
    }
    
    const categoryCounts: Record<string, number> = {};
    
    if (aggs?.by_category?.buckets) {
      aggs.by_category.buckets.forEach((bucket: any) => {
        categoryCounts[bucket.key] = bucket.total_value.value;
      });
    }
    
    return NextResponse.json({
      period: {
        days,
        from: startDate.toISOString(),
        to: now.toISOString(),
      },
      metrics: metricsByName,
      categories: categoryCounts,
    });
    
  } catch (error: any) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics', details: error.message },
      { status: 500 }
    );
  }
}
