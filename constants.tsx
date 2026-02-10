import React from 'react';
import { Confession, Topic } from './types';

export const CURRENT_TOPIC: Topic = {
  id: 'topic-1',
  badge: 'This week’s topic: Love',
  headline: "Things you haven't dared to tell your boss.",
  subtext: "Share the feelings you’ve kept to yourself."
};

export const MOCK_CONFESSIONS: Confession[] = [
  {
    id: 'c4',
    title: "The Sign Swapper Investment",
    content: "On my daily commute there was very inconvenient 'no right turn between 7am-9:30am' sign. I had to make the right turn abut 7:20am every day. For a long time I would just break the law and make my turn any way or go around if I thought there was too many people watching. But (maybe out of boredom) I did a bit of research and found the ticket for the illegal turn was more than buying a sign from the supplier that makes signs for our area and several other locations. So I ordered a new sign that was 'no right turn between 7:30am- 9:30am'. I figured it was a good investment. I went to the trouble of buying it through an alias and having it sent to a location that was not at all near to where I was. Real cloak and dagger stuff, but it was part of the fun.\n\nThen in the middle of the night I went and removed two bolts and put up the new sign.\n\nAt first I was expecting for it to be removed or someone look into to it, but it is more than a decade later and no one ever noticed or changed it.\n\nBTY, Yes I did think of just taking it down, but I figured that would be noticed by someone, and to be honest the whole scheme of getting a new one was part of the fun.",
    createdAt: new Date().toISOString(),
    readerCount: 243,
    reactions: { '😉': 56, '🥰': 12, '❤️': 8 }
  },
  {
    id: 'c1',
    title: "I changed a road sign to make my commute easier 13 years ago",
    content: "It was a small intersection near my house that always had a 'No Left Turn' sign during peak hours. I realized it was completely arbitrary based on old traffic patterns. One night, I just... painted over the restricted hours. It's been like that for over a decade now and traffic actually flows better. I still feel a weird mix of guilt and pride every time I make that turn.",
    createdAt: new Date().toISOString(),
    readerCount: 85,
    reactions: { '❤️': 12, '🥰': 5, '😉': 3 }
  },
  {
    id: 'c2',
    title: "The hidden office snack thief",
    content: "Everyone in the office thinks it's Dave from accounting because he's always hanging around the breakroom. It's actually me, the HR manager. I started doing it during a really stressful project two years ago and now it's just a habit. I even 'investigated' the complaints once to throw people off the scent. I feel terrible but those artisan crackers are just too good.",
    createdAt: new Date().toISOString(),
    readerCount: 42,
    reactions: { '🥰': 8, '😉': 15 }
  },
  {
    id: 'c3',
    content: "I've been faking my degree for 5 years. I'm actually really good at my job, lead a team of 10, and have been promoted twice. But every background check season I have a near-panic attack. I dropped out 3 credits short due to family issues and just... never went back. I'm trapped in a lie that built my entire life.",
    createdAt: new Date().toISOString(),
    readerCount: 156,
    reactions: { '❤️': 45, '😢': 22 }
  }
];

export const COLORS = {
  blue: '#4A90E2',
  pink: '#FF6B9D',
  orange: '#FF8C42',
  black: '#1A1A1A',
  badge: '#FF5722'
};