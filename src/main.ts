import { Plugin } from 'obsidian'

export default class JokerTypePlugin extends Plugin {
  async onload(): Promise<void> {
    console.log('JokerType loaded')
  }
}
