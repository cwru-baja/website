/** Whole dollars, as "$2,615". Its own module so the site-wide bar can use it without the dares member list. */
export const formatUsd = (n: number) => `$${n.toLocaleString("en-US")}`;
