// Simple web search implementation using a search API
// In production, you might want to use Google Custom Search API, Bing Search API, etc.

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function searchWeb(query: string): Promise<SearchResult[]> {
  try {
    // Using DuckDuckGo Instant Answer API as a fallback
    // In production, replace with proper search API like Google Custom Search
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
    const data = await response.json();
    
    const results: SearchResult[] = [];
    
    // Extract results from DuckDuckGo API response
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      for (let i = 0; i < Math.min(5, data.RelatedTopics.length); i++) {
        const topic = data.RelatedTopics[i];
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 100),
            url: topic.FirstURL,
            snippet: topic.Text
          });
        }
      }
    }
    
    // If no results from related topics, try abstract
    if (results.length === 0 && data.Abstract) {
      results.push({
        title: data.Heading || "Search Result",
        url: data.AbstractURL || "#",
        snippet: data.Abstract
      });
    }
    
    return results;
  } catch (error) {
    console.error("Web search error:", error);
    return [];
  }
}

export async function enhanceResponseWithWebData(userMessage: string, aiResponse: string): Promise<string> {
  // Check if the message seems to be asking for current/real-time information
  const currentInfoKeywords = ['weather', 'news', 'current', 'today', 'now', 'latest', 'recent', 'price', 'stock'];
  const needsWebSearch = currentInfoKeywords.some(keyword => 
    userMessage.toLowerCase().includes(keyword)
  );
  
  if (!needsWebSearch) {
    return aiResponse;
  }
  
  try {
    const searchResults = await searchWeb(userMessage);
    
    if (searchResults.length > 0) {
      const webInfo = searchResults.slice(0, 2).map(result => 
        `${result.title}: ${result.snippet}`
      ).join('\n\n');
      
      return `${aiResponse}\n\n*Real-time info (because you asked for current data):*\n${webInfo}`;
    }
  } catch (error) {
    console.error("Web search enhancement error:", error);
  }
  
  return aiResponse;
}
