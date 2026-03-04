import React from "react";
import {
  Body,
  Button,
  Column,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

interface LeaderboardEntry {
  rank: number;
  name: string;
  visits: number;
  revenue: number;
  conversionRate: number;
}

interface WeeklyStats {
  visits: number;
  revenue: number;
  conversionRate: number;
  rankChange: number;
}

interface LeaderboardDigestProps {
  repName: string;
  repEmail: string;
  division: string;
  currentRank: number;
  weeklyStats: WeeklyStats;
  previousWeekStats: WeeklyStats;
  topFive: LeaderboardEntry[];
  yourRank: number;
  motivationalMessage: string;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const LeaderboardDigest = ({
  repName,
  repEmail,
  division,
  currentRank,
  weeklyStats,
  previousWeekStats,
  topFive,
  yourRank,
  motivationalMessage,
}: LeaderboardDigestProps) => {
  const rankImprovement = previousWeekStats
    ? weeklyStats.rankChange - previousWeekStats.rankChange
    : 0;
  const isRankingUp = rankImprovement > 0;

  return (
    <Html>
      <Head>
        <Font
          fontFamily="Segoe UI"
          fallbackFontFamily="sans-serif"
          webFont={{
            url: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap",
            format: "woff2",
          }}
        />
      </Head>
      <Preview>
        Your weekly leaderboard summary - Rank #{currentRank} in {division}
      </Preview>

      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={headerSection}>
            <Row style={{ width: "100%" }}>
              <Column style={headerColumn}>
                <Img
                  src={`${baseUrl}/logo-white.png`}
                  width="32"
                  height="32"
                  alt="Field Sales Command"
                />
                <Text style={headerText}>Field Sales Command</Text>
              </Column>
              <Column style={{ textAlign: "right" as const, width: "50%" }}>
                <Text
                  style={{
                    color: "#666666",
                    fontSize: "12px",
                    margin: "0",
                  }}
                >
                  Weekly Summary
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Greeting */}
          <Section style={section}>
            <Text style={greeting}>
              Hey {repName}! 👋
            </Text>
            <Text style={subtext}>
              Here's your leaderboard update for {division} division
            </Text>
          </Section>

          {/* Your Rank Card */}
          <Section style={rankCardSection}>
            <Row style={{ width: "100%" }}>
              <Column style={rankCardContent}>
                <Text style={rankLabel}>Your Rank</Text>
                <Text style={rankNumber}>#{currentRank}</Text>
                <Text
                  style={{
                    color: isRankingUp ? "#10b981" : "#ef4444",
                    fontSize: "14px",
                    fontWeight: "600",
                    margin: "8px 0 0 0",
                  }}
                >
                  {isRankingUp ? "📈" : "📉"} {Math.abs(rankImprovement)} places{" "}
                  {isRankingUp ? "up" : "down"}
                </Text>
              </Column>

              <Column style={statsColumn}>
                <Row style={{ marginBottom: "12px" }}>
                  <Column style={statItem}>
                    <Text style={statLabel}>Visits</Text>
                    <Text style={statValue}>{weeklyStats.visits}</Text>
                    <Text style={statChange}>
                      {weeklyStats.visits > previousWeekStats.visits ? "+" : ""}
                      {weeklyStats.visits - previousWeekStats.visits} vs last week
                    </Text>
                  </Column>
                </Row>
                <Row>
                  <Column style={statItem}>
                    <Text style={statLabel}>Revenue</Text>
                    <Text style={statValue}>
                      ${(weeklyStats.revenue / 1000).toFixed(1)}k
                    </Text>
                    <Text style={statChange}>
                      {weeklyStats.revenue > previousWeekStats.revenue
                        ? "+"
                        : ""}
                      ${(
                        (weeklyStats.revenue - previousWeekStats.revenue) /
                        1000
                      ).toFixed(1)}k vs last week
                    </Text>
                  </Column>
                </Row>
              </Column>
            </Row>
          </Section>

          {/* Top 5 Leaderboard */}
          <Section style={section}>
            <Text style={sectionTitle}>Top 5 in {division}</Text>

            {topFive.map((entry, index) => (
              <Row
                key={index}
                style={{
                  ...leaderboardRow,
                  backgroundColor:
                    entry.rank === currentRank ? "#f0f9ff" : "transparent",
                  borderLeft:
                    entry.rank === currentRank ? "4px solid #3b82f6" : "none",
                }}
              >
                <Column style={{ width: "10%", textAlign: "center" as const }}>
                  <Text style={rankBadge}>
                    {entry.rank === 1
                      ? "🥇"
                      : entry.rank === 2
                        ? "🥈"
                        : entry.rank === 3
                          ? "🥉"
                          : `#${entry.rank}`}
                  </Text>
                </Column>
                <Column style={{ width: "30%" }}>
                  <Text
                    style={{
                      fontSize: "14px",
                      fontWeight: entry.rank === currentRank ? "700" : "500",
                      margin: "0",
                      color: "#1f2937",
                    }}
                  >
                    {entry.name}
                    {entry.rank === currentRank && " (You)"}
                  </Text>
                </Column>
                <Column style={{ width: "20%", textAlign: "right" as const }}>
                  <Text style={leaderboardMetric}>{entry.visits} visits</Text>
                </Column>
                <Column style={{ width: "20%", textAlign: "right" as const }}>
                  <Text style={leaderboardMetric}>
                    ${(entry.revenue / 1000).toFixed(1)}k
                  </Text>
                </Column>
                <Column style={{ width: "20%", textAlign: "right" as const }}>
                  <Text style={leaderboardMetric}>
                    {(entry.conversionRate * 100).toFixed(0)}%
                  </Text>
                </Column>
              </Row>
            ))}
          </Section>

          {/* Motivational Message */}
          <Section style={motivationalSection}>
            <Text style={motivationalText}>{motivationalMessage}</Text>
          </Section>

          {/* CTA */}
          <Section style={section}>
            <Button style={ctaButton}>
              <Link
                href={`${baseUrl}/leaderboard?division=${division}`}
                style={ctaButtonText}
              >
                View Full Leaderboard
              </Link>
            </Button>
          </Section>

          {/* Footer */}
          <Hr style={divider} />
          <Section style={footerSection}>
            <Text style={footerText}>
              © 2024 Field Sales Command. All rights reserved.
            </Text>
            <Text style={footerText}>
              <Link href={`${baseUrl}/account/notifications`} style={footerLink}>
                Manage preferences
              </Link>
              {" • "}
              <Link href={`${baseUrl}/help`} style={footerLink}>
                Help
              </Link>
              {" • "}
              <Link href={`${baseUrl}/contact`} style={footerLink}>
                Contact
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  fontFamily:
    "'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Helvetica Neue', sans-serif",
  lineHeight: "1.5",
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  maxWidth: "600px",
  margin: "0 auto",
  borderRadius: "8px",
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
};

const headerSection: React.CSSProperties = {
  backgroundColor: "#1f2937",
  padding: "24px",
};

const headerColumn: React.CSSProperties = {
  display: "flex" as const,
  alignItems: "center",
  gap: "12px",
  width: "50%",
};

const headerText: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "18px",
  fontWeight: "700",
  margin: "0",
};

const section: React.CSSProperties = {
  padding: "32px 24px",
};

const greeting: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "700",
  color: "#1f2937",
  margin: "0 0 8px 0",
};

const subtext: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
  margin: "0",
};

const rankCardSection: React.CSSProperties = {
  ...section,
  backgroundColor: "#f3f4f6",
  display: "flex" as const,
  padding: "24px",
};

const rankCardContent: React.CSSProperties = {
  backgroundColor: "#3b82f6",
  color: "#ffffff",
  padding: "24px",
  borderRadius: "8px",
  width: "40%",
  textAlign: "center" as const,
};

const rankLabel: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: "600",
  textTransform: "uppercase" as const,
  margin: "0",
  opacity: 0.9,
};

const rankNumber: React.CSSProperties = {
  fontSize: "48px",
  fontWeight: "700",
  margin: "8px 0 0 0",
};

const statsColumn: React.CSSProperties = {
  paddingLeft: "24px",
  width: "60%",
};

const statItem: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "12px",
  borderRadius: "6px",
};

const statLabel: React.CSSProperties = {
  fontSize: "11px",
  color: "#9ca3af",
  fontWeight: "600",
  textTransform: "uppercase" as const,
  margin: "0",
};

const statValue: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "700",
  color: "#1f2937",
  margin: "4px 0 0 0",
};

const statChange: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  margin: "4px 0 0 0",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "700",
  color: "#1f2937",
  margin: "0 0 16px 0",
};

const leaderboardRow: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "16px 0",
  display: "flex" as const,
};

const rankBadge: React.CSSProperties = {
  fontSize: "18px",
  margin: "0",
};

const leaderboardMetric: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
  margin: "0",
};

const motivationalSection: React.CSSProperties = {
  ...section,
  backgroundColor: "#f0fdf4",
  borderLeft: "4px solid #10b981",
};

const motivationalText: React.CSSProperties = {
  fontSize: "14px",
  color: "#065f46",
  fontWeight: "500",
  margin: "0",
  fontStyle: "italic" as const,
};

const ctaButton: React.CSSProperties = {
  backgroundColor: "#3b82f6",
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
  fontWeight: "600",
  fontSize: "14px",
  display: "inline-block" as const,
};

const ctaButtonText: React.CSSProperties = {
  color: "#ffffff",
  textDecoration: "none",
};

const divider: React.CSSProperties = {
  margin: "0",
  borderTop: "1px solid #e5e7eb",
};

const footerSection: React.CSSProperties = {
  padding: "24px",
  textAlign: "center" as const,
  backgroundColor: "#f9fafb",
};

const footerText: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  margin: "8px 0",
};

const footerLink: React.CSSProperties = {
  color: "#3b82f6",
  textDecoration: "none",
};

export default LeaderboardDigest;
