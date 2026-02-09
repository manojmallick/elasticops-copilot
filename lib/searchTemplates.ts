/**
 * Search templates for different query patterns
 */

/**
 * Hybrid search: combines BM25 (text matching) with kNN (vector similarity)
 * Used for KB article search
 */
export function buildHybridSearch(
  queryText: string,
  queryVector: number[],
  fields: string[] = ['title', 'content'],
  knnField: string = 'embedding',
  k: number = 10
) {
  return {
    knn: {
      field: knnField,
      query_vector: queryVector,
      k,
      num_candidates: 50,
    },
    query: {
      bool: {
        should: [
          {
            multi_match: {
              query: queryText,
              fields,
              type: 'best_fields',
              boost: 0.5,
            },
          },
        ],
      },
    },
    size: k,
    highlight: {
      fields: fields.reduce((acc, field) => {
        acc[field] = { fragment_size: 150, number_of_fragments: 2 };
        return acc;
      }, {} as Record<string, any>),
    },
  };
}

/**
 * Ticket deduplication search: kNN + filters
 * Used to find similar tickets before creating new ones
 */
export function buildTicketDedupeSearch(
  queryVector: number[],
  category?: string,
  excludeId?: string,
  k: number = 5
) {
  const filter: any[] = [{ term: { status: 'open' } }];
  
  if (category) {
    filter.push({ term: { category } });
  }
  
  if (excludeId) {
    filter.push({ bool: { must_not: { term: { _id: excludeId } } } });
  }

  return {
    knn: {
      field: 'embedding',
      query_vector: queryVector,
      k,
      num_candidates: 50,
      filter: {
        bool: {
          filter,
        },
      },
    },
    size: k,
    highlight: {
      fields: {
        subject: { fragment_size: 150, number_of_fragments: 1 },
        description: { fragment_size: 150, number_of_fragments: 2 },
      },
    },
  };
}

/**
 * Resolution retrieval: kNN search
 * Used to find relevant resolution steps for incidents/tickets
 */
export function buildResolutionSearch(
  queryVector: number[],
  category?: string,
  severity?: string,
  k: number = 5
) {
  const filter: any[] = [];
  
  if (category) {
    filter.push({ term: { category } });
  }
  
  if (severity) {
    filter.push({ term: { severity } });
  }

  const knnQuery: any = {
    field: 'embedding',
    query_vector: queryVector,
    k,
    num_candidates: 50,
  };

  if (filter.length > 0) {
    knnQuery.filter = {
      bool: { filter },
    };
  }

  return {
    knn: knnQuery,
    size: k,
  };
}

/**
 * Ticket search with filters
 */
export function buildTicketSearch(filters: {
  status?: string[];
  category?: string[];
  severity?: string[];
  priority?: string[];
  from?: number;
  size?: number;
}) {
  const must: any[] = [];

  if (filters.status && filters.status.length > 0) {
    must.push({ terms: { status: filters.status } });
  }

  if (filters.category && filters.category.length > 0) {
    must.push({ terms: { category: filters.category } });
  }

  if (filters.severity && filters.severity.length > 0) {
    must.push({ terms: { severity: filters.severity } });
  }

  if (filters.priority && filters.priority.length > 0) {
    must.push({ terms: { priority: filters.priority } });
  }

  return {
    query: {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
      },
    },
    sort: [{ created_at: { order: 'desc' } }],
    from: filters.from || 0,
    size: filters.size || 50,
  };
}
