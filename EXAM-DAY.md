# Exam day playbook

The exam tests speed as much as knowledge. Many well-prepared candidates lose points to the environment, the clock or nerves. This page covers all three.

Facts below come from the official [CKA & CKAD tips](https://docs.linuxfoundation.org/tc-docs/certification/tips-cka-and-ckad) and the [Candidate Handbook](https://docs.linuxfoundation.org/tc-docs/certification/lf-handbook2). Re-read both the week before your exam, because the environment changes over time.

## The week before

- [ ] Run the official **system check** on the exact computer, network and room you'll use.
- [ ] Install the **PSI Secure Browser** and launch it at least once.
- [ ] **Keyboard: keep only one input language/layout installed and disable every layout-switching hotkey.** You'll use `Ctrl+Shift+C/V` constantly. If a hotkey switches your layout mid-exam, you can lose many minutes and you can't leave the exam UI to fix it.
  - Windows: *Settings → Time & language → Typing → Advanced keyboard settings → Input language hot keys* → set both sequences to *Not assigned*.
  - macOS: *System Settings → Keyboard → Keyboard Shortcuts → Input Sources* → untick them.
- [ ] One monitor only. 1080p or higher is recommended.
- [ ] Wired network if you can. Close VPNs, sync clients and anything that pops up notifications.
- [ ] Valid government ID that matches your registration name exactly.
- [ ] Clean desk and walls. No papers, no second screen, no phone in reach.

## The exam environment

- You work in a **remote Linux desktop** inside the PSI Secure Browser, with a terminal and a browser for the allowed docs.
- **Each task tells you which host to `ssh` into.** Do it every time. When you finish, `exit` back to the base host. Nested ssh isn't supported. Use `sudo -i` if a task needs root.
- On the task hosts, `kubectl` with the **`k` alias and bash completion** is already set up, along with `yq`, `curl`, `wget` and `man`.
- Shortcuts that differ from your laptop:
  - Terminal copy / paste: **`Ctrl+Shift+C` / `Ctrl+Shift+V`** (right-click works too)
  - Close a browser tab: **`Ctrl+Alt+W`**, not `Ctrl+W`
  - The **Insert key is blocked**. In vim, use `i` to insert and `Esc` to leave insert mode.
- Allowed docs: kubernetes.io/docs, kubernetes.io/blog and helm.sh/docs ([full list](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed)).

## First 60 seconds

Most people only need this, on each host where they'll edit YAML:

```bash
echo 'set ts=2 sw=2 et ai nu' >> ~/.vimrc
export do="--dry-run=client -o yaml"     # only if you trained with it
```

Don't build an elaborate setup. Anything you didn't train with costs you time.

## Strategy for the 2 hours

1. **Read each task's weight.** Tasks are weighted differently. Don't spend 15 minutes on a 2% task.
2. **First pass: solve everything you can do in under ~6 minutes.** Flag the rest and move on. Being stuck is the most expensive thing that can happen in this exam.
3. **Second pass:** go back to the flagged tasks, heaviest first.
4. **Use the exact names, namespaces and file paths.** Copy them from the task with `Ctrl+Shift+C` instead of retyping.
5. **Check you're on the right host/namespace** before you create anything. `k config view --minify | grep namespace` or just pass `-n` every time.
6. **Verify every task** before leaving it: `k get`, `k describe`, `k logs`, or a curl from a test Pod.
7. **Save requested output to the requested file.** If a task asks for a file, it's graded on the file.
8. Imperative first (`k create/run/expose ... --dry-run=client -o yaml`), then edit. Copy YAML from the docs only for what you can't generate (PV/PVC, NetworkPolicy, probes).
9. Leave 10 minutes at the end to re-check the flagged tasks and anything you're unsure about.

## On the day

- Eat, hydrate, use the bathroom before you start.
- Log in early. Check-in (ID check, room scan) takes time, so don't start it stressed and in a rush.
- If something technical goes wrong, tell the proctor via chat right away. Don't silently try to fix it.
- If you go blank on a task: flag it, take one breath, do the next task. Points are points, in any order.

## After the exam

Your score report arrives by email within 24 hours ([FAQ](https://docs.linuxfoundation.org/tc-docs/certification/faq-cka-ckad-cks)). If you don't pass, your exam purchase includes one retake. Use the score report to target your weakest domains and go back to [Weeks 6–8 of the roadmap](ROADMAP.md).
