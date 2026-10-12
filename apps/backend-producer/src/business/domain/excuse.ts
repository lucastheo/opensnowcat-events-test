export class Excuse {
  constructor(
    public readonly id: number,
    public readonly text: string
  ) {}

  public get excuse(): string {
    return this.text;
  }
}

export const DEVELOPER_EXCUSES: readonly string[] = [
  "It works on my machine.",
  "That wasn't in the original requirements.",
  "It's not a bug, it's an undocumented feature.",
  "My branch has 87 merge conflicts and git is currently in a detached HEAD existential crisis.",
  "Someone must have changed the environment variables overnight.",
  "The third-party API must be down or returning unexpected payloads.",
  "I thought we agreed to refactor that in sprint 42.",
  "That was legacy code written before I joined the team.",
  "It passed all the unit tests in CI, I swear.",
  "Docker must be caching an outdated layer with phantom bugs.",
  "The cosmic rays probably flipped a bit in the production RAM.",
  "It was working perfectly when I demoed it five minutes ago.",
  "Our linter didn't warn us about that edge case.",
  "The DNS propagation is taking longer than expected.",
  "I was told that service was completely deprecated and safe to delete.",
  "The database index rebuild locked the entire table.",
  "That edge case only happens on leap years during daylight saving transitions.",
  "I haven't had my morning coffee yet to parse that stack trace.",
  "The package maintainer published a breaking change in a patch release.",
  "It's a known race condition scheduled for resolution post-MVP.",
  "Someone pushed directly to main with --force without telling anyone.",
  "The frontend cache is stubbornly stale across all browser nodes."
];
