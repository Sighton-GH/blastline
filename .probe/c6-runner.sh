#!/bin/bash
cd /home/sandbox/blastline
DIFF=veteran node .probe/c5-lategame.mjs > /home/sandbox/c6-evidence/lategame-veteran-newcurve.log 2>&1
DIFF=elite node .probe/c5-lategame.mjs > /home/sandbox/c6-evidence/lategame-elite-newcurve.log 2>&1
node .probe/c6-heap.mjs > /home/sandbox/c6-evidence/heap-soak.log 2>&1
echo DONE > /home/sandbox/c6-evidence/runner.done
