import { Sandbox } from 'e2b';

const apiKey = 'e2b_b226b826b45117ef758823924c02addb8e6de81d';

async function main() {
  console.log('Testing Sandbox creation...');
  let sbx;
  try {
    console.log('Attempting custom template: lanes-project-aba0/dsh-worker');
    sbx = await Sandbox.create('lanes-project-aba0/dsh-worker', {
      apiKey,
      timeoutMs: 3_600_000,
    });
    console.log('Successfully created sandbox from template lanes-project-aba0/dsh-worker');
  } catch (err: any) {
    console.log('Custom template error:', err.message);
    console.log('Falling back to default base sandbox...');
    sbx = await Sandbox.create({
      apiKey,
      timeoutMs: 3_600_000,
    });
    console.log('Successfully created base sandbox!');
  }

  console.log('Sandbox ID:', sbx.sandboxId);

  // Inspect environment
  const uname = await sbx.commands.run('uname -a');
  console.log('OS info:', uname.stdout.trim());

  const cpu = await sbx.commands.run('nproc && lscpu | grep "Model name" || true');
  console.log('CPU info:', cpu.stdout.trim());

  const mem = await sbx.commands.run('free -h');
  console.log('Memory info:\n' + mem.stdout.trim());

  const disk = await sbx.commands.run('df -h /');
  console.log('Disk info:\n' + disk.stdout.trim());

  const tools = await sbx.commands.run('which rustc cargo python3 node bun git 2>&1 || true');
  console.log('Installed tools:\n' + tools.stdout.trim());

  console.log('Keeping sandbox alive for inspection...');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
