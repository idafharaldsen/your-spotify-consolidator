import { StatsCard } from "@/components/stats-card";

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Welcome to SpotifyStats</h1>
          <p className="text-muted-foreground">
            Your personal Spotify listening analytics dashboard
          </p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard 
            title="Total Songs" 
            value="56,636" 
          />
          <StatsCard 
            title="Total Plays" 
            value="178,502" 
          />
          <StatsCard 
            title="Hours Listened" 
            value="8,601" 
          />
          <StatsCard 
            title="Top Artist" 
            value="David Bowie" 
            subtitle="2,548 plays"
          />
        </div>
      </div>
    </main>
  );
}
