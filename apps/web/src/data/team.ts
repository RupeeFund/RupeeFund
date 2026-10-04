export interface TeamMember {
  readonly name: string;
  readonly bio?: string;
  readonly profileUrl?: string;
  readonly username?: string;
  readonly photoUrl?: string;
}

export const COMMUNITY_TEAM: readonly TeamMember[] = [
  {
    name: "Shree Kumar",
    bio: "Shree (Kumar) is an active volunteer at FOSS United and was formerly an elected " +
         "member of its Governance Board. Shree helps run IndiaFOSS, arguably India's " +
         "largest volunteer run conference dedicated to Free and Open Source Software, " +
         "Hardware, and the wider digital commons.",
    profileUrl: "https://fossunited.org/u/shreekumar3d",
    username: "shreekumar3d",
    photoUrl: "https://github.com/shreekumar3d.png?size=128",
  },
  {
    name: "Mrugesh Mohapatra",
    bio: "Mrugesh is an active member of the FOSS United community and organises meetups for the Agentic AI Foundation’s Bengaluru Chapter.",
    profileUrl: "https://fossunited.org/u/mrugesh",
    username: "mrugesh",
    photoUrl: "https://github.com/raisedadead.png?size=128",
  },
  {
    name: "Khitab",
    bio:
      "Khitab is a FOSS United volunteer who builds and maintains The\u00a0Rupee\u00a0Fund’s " +
      "website. He’s a data engineer drawn to how open source underpins India’s Digital " +
      "Public Infrastructure (DPI) and Digital Public Goods (DPG).",
    profileUrl: "https://www.linkedin.com/in/khitab/",
    username: "khitab",
    photoUrl: "https://github.com/khitab.png?size=128",
  },
];
